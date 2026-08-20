import os
import chromadb
from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image, ImageOps
import torch

# Initialize ChromaDB client to store data in a local folder
CHROMA_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".chroma_db")
client = chromadb.PersistentClient(path=CHROMA_DATA_PATH)

# Get or create the collection for employee faces
# We use cosine similarity by default in Chroma for FaceNet/VGG-Face embeddings
face_collection = client.get_or_create_collection(
    name="employee_faces",
    metadata={"hnsw:space": "cosine"}
)

# Initialize models (CPU only to save memory, as requested by user)
device = torch.device('cpu')
# MTCNN detects the face and crops it automatically
mtcnn = MTCNN(keep_all=False, device=device)
# InceptionResnetV1 extracts the robust facial embedding
resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)

def extract_face_embedding(image_path: str):
    """
    Extracts the facial embedding from an image using Facenet-PyTorch.
    Raises ValueError if no face is detected.
    """
    try:
        img = ImageOps.exif_transpose(Image.open(image_path)).convert('RGB')
        
        # Detect face and crop
        face_tensor = mtcnn(img)
        if face_tensor is None:
            raise ValueError("No face detected.")
            
        # Add batch dimension [1, 3, 160, 160]
        face_tensor = face_tensor.unsqueeze(0).to(device)
        
        # Extract embedding
        with torch.no_grad():
            embedding = resnet(face_tensor)
            
        # Return as a 1D float list for ChromaDB
        return embedding[0].tolist()
    except Exception as e:
        if str(e) == "No face detected.":
            raise
        raise ValueError(f"Face extraction failed: {str(e)}")

def register_user_face(user_id: str, image_path: str, enterprise_id: str | None = None):
    """Extract and upsert one employee embedding with organization metadata."""
    embedding = extract_face_embedding(image_path)
    metadata = {"user_id": str(user_id)}
    if enterprise_id is not None:
        metadata["enterprise_id"] = str(enterprise_id)

    # Upsert allows an employee to re-enroll after an approved identity update.
    face_collection.upsert(
        ids=[str(user_id)],
        embeddings=[embedding],
        metadatas=[metadata],
    )
    return True

def has_user_face(user_id: str) -> bool:
    """Return whether an organization-scoped embedding exists for this user."""
    result = face_collection.get(where={"user_id": str(user_id)}, include=[])
    return bool(result.get("ids"))


def delete_user_face(user_id: str) -> None:
    """Remove all biometric templates belonging to an organization user."""
    face_collection.delete(ids=[str(user_id)])


def verify_user_face(
    image_path: str,
    threshold: float = 0.5,
    enterprise_id: str | None = None,
    user_id: str | None = None,
):
    """Match a capture against an optional organization- and user-scoped set."""
    embedding = extract_face_embedding(image_path)
    if face_collection.count() == 0:
        return None, None

    where = None
    if user_id is not None:
        # User IDs are globally unique. Querying by user_id keeps older
        # embeddings usable when they predate enterprise_id metadata while
        # still preventing cross-user matches.
        where = {"user_id": str(user_id)}
    elif enterprise_id is not None:
        where = {"enterprise_id": str(enterprise_id)}

    query_kwargs = {"query_embeddings": [embedding], "n_results": 1}
    if where is not None:
        query_kwargs["where"] = where
    results = face_collection.query(**query_kwargs)
    if not results["ids"] or not results["ids"][0]:
        return None, None

    closest_user_id = results["ids"][0][0]
    distance = results["distances"][0][0]
    return (closest_user_id, distance) if distance <= threshold else (None, distance)
