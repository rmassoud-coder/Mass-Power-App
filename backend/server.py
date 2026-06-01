from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import bcrypt
import jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Pydantic Models
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, handler):
        schema.update(type="string")
        return schema

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    username: str

class CustomerCreate(BaseModel):
    name: str
    mobile_number: str

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    mobile_number: Optional[str] = None

class Customer(BaseModel):
    id: str
    name: str
    mobile_number: str
    created_at: datetime
    updated_at: datetime

class VehicleCreate(BaseModel):
    customer_id: str
    vin: str
    plate_number: str
    make: str
    model: str
    year: Optional[str] = None

class VehicleUpdate(BaseModel):
    vin: Optional[str] = None
    plate_number: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None

class Vehicle(BaseModel):
    id: str
    customer_id: str
    vin: str
    plate_number: str
    make: str
    model: str
    year: Optional[str] = None
    created_at: datetime

class ServiceCreate(BaseModel):
    vehicle_id: str
    service_description: str
    additional_info: Optional[str] = None
    cost: float
    service_date: Optional[datetime] = None

class ServiceUpdate(BaseModel):
    service_description: Optional[str] = None
    additional_info: Optional[str] = None
    cost: Optional[float] = None
    service_date: Optional[datetime] = None

class Service(BaseModel):
    id: str
    vehicle_id: str
    customer_id: str
    service_description: str
    additional_info: Optional[str] = None
    cost: float
    service_date: datetime
    created_at: datetime

class VINDecodeResponse(BaseModel):
    vin: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    error: Optional[str] = None

class CustomerDetailResponse(BaseModel):
    customer: Customer
    vehicles: List[Vehicle]
    services: List[Service]

class SearchResult(BaseModel):
    customer: Customer
    vehicles: List[Vehicle]
    total_services: int

# Helper Functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

# Initialize default user on startup
@app.on_event("startup")
async def startup_db():
    # Create default user if not exists
    existing_user = await db.users.find_one({"username": "admin"})
    if not existing_user:
        hashed_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
        await db.users.insert_one({
            "username": "admin",
            "password": hashed_password.decode('utf-8'),
            "created_at": datetime.utcnow()
        })
        logger.info("Default user created: admin/admin123")
    
    # Create indexes
    await db.customers.create_index("mobile_number")
    await db.vehicles.create_index("vin")
    await db.vehicles.create_index("plate_number")
    await db.vehicles.create_index("customer_id")
    await db.services.create_index("vehicle_id")
    await db.services.create_index("customer_id")

# Authentication Routes
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user = await db.users.find_one({"username": request.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(request.password.encode('utf-8'), user["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user["username"]})
    return LoginResponse(token=token, username=user["username"])

@api_router.get("/auth/verify")
async def verify(username: str = Depends(verify_token)):
    return {"username": username, "valid": True}

# Customer Routes
@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate, username: str = Depends(verify_token)):
    # Check if mobile number already exists
    existing = await db.customers.find_one({"mobile_number": customer.mobile_number})
    if existing:
        raise HTTPException(status_code=400, detail="Customer with this mobile number already exists")
    
    customer_dict = customer.dict()
    customer_dict["created_at"] = datetime.utcnow()
    customer_dict["updated_at"] = datetime.utcnow()
    
    result = await db.customers.insert_one(customer_dict)
    customer_dict["id"] = str(result.inserted_id)
    del customer_dict["_id"]
    
    return Customer(**customer_dict)

@api_router.get("/customers/search", response_model=List[SearchResult])
async def search_customers(q: str, username: str = Depends(verify_token)):
    # Search by name or mobile number (partial match)
    query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"mobile_number": {"$regex": q, "$options": "i"}}
        ]
    }
    
    customers = await db.customers.find(query).to_list(100)
    results = []
    
    for customer in customers:
        customer_id = str(customer["_id"])
        vehicles = await db.vehicles.find({"customer_id": customer_id}).to_list(100)
        services_count = await db.services.count_documents({"customer_id": customer_id})
        
        results.append(SearchResult(
            customer=Customer(**serialize_doc(customer)),
            vehicles=[Vehicle(**serialize_doc(v)) for v in vehicles],
            total_services=services_count
        ))
    
    return results

@api_router.get("/customers/{customer_id}/details", response_model=CustomerDetailResponse)
async def get_customer_details(customer_id: str, username: str = Depends(verify_token)):
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    vehicles = await db.vehicles.find({"customer_id": customer_id}).to_list(100)
    services = await db.services.find({"customer_id": customer_id}).sort("service_date", -1).to_list(1000)
    
    return CustomerDetailResponse(
        customer=Customer(**serialize_doc(customer)),
        vehicles=[Vehicle(**serialize_doc(v)) for v in vehicles],
        services=[Service(**serialize_doc(s)) for s in services]
    )

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, update_data: CustomerUpdate, username: str = Depends(verify_token)):
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    if update_dict:
        await db.customers.update_one({"_id": ObjectId(customer_id)}, {"$set": update_dict})
    
    updated_customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    return Customer(**serialize_doc(updated_customer))

# Vehicle Routes
@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle: VehicleCreate, username: str = Depends(verify_token)):
    # Verify customer exists
    customer = await db.customers.find_one({"_id": ObjectId(vehicle.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    vehicle_dict = vehicle.dict()
    vehicle_dict["created_at"] = datetime.utcnow()
    
    result = await db.vehicles.insert_one(vehicle_dict)
    vehicle_dict["id"] = str(result.inserted_id)
    del vehicle_dict["_id"]
    
    return Vehicle(**vehicle_dict)

@api_router.get("/vehicles/search-vin")
async def search_by_vin(vin: str, username: str = Depends(verify_token)):
    # Partial match on VIN
    vehicles = await db.vehicles.find({"vin": {"$regex": vin, "$options": "i"}}).to_list(100)
    
    results = []
    for vehicle in vehicles:
        customer_id = vehicle["customer_id"]
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        services_count = await db.services.count_documents({"vehicle_id": str(vehicle["_id"])})
        
        if customer:
            # Get all vehicles for this customer
            all_vehicles = await db.vehicles.find({"customer_id": customer_id}).to_list(100)
            results.append(SearchResult(
                customer=Customer(**serialize_doc(customer)),
                vehicles=[Vehicle(**serialize_doc(v)) for v in all_vehicles],
                total_services=services_count
            ))
    
    return results

@api_router.get("/vehicles/search-plate")
async def search_by_plate(plate: str, username: str = Depends(verify_token)):
    # Partial match on plate number
    vehicles = await db.vehicles.find({"plate_number": {"$regex": plate, "$options": "i"}}).to_list(100)
    
    results = []
    for vehicle in vehicles:
        customer_id = vehicle["customer_id"]
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        services_count = await db.services.count_documents({"vehicle_id": str(vehicle["_id"])})
        
        if customer:
            # Get all vehicles for this customer
            all_vehicles = await db.vehicles.find({"customer_id": customer_id}).to_list(100)
            results.append(SearchResult(
                customer=Customer(**serialize_doc(customer)),
                vehicles=[Vehicle(**serialize_doc(v)) for v in all_vehicles],
                total_services=services_count
            ))
    
    return results

@api_router.get("/vehicles/decode-vin/{vin}", response_model=VINDecodeResponse)
async def decode_vin(vin: str, username: str = Depends(verify_token)):
    """Decode VIN using NHTSA API"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json")
            data = response.json()
            
            if "Results" in data:
                results = data["Results"]
                make = next((r["Value"] for r in results if r["Variable"] == "Make" and r["Value"]), None)
                model = next((r["Value"] for r in results if r["Variable"] == "Model" and r["Value"]), None)
                year = next((r["Value"] for r in results if r["Variable"] == "Model Year" and r["Value"]), None)
                
                return VINDecodeResponse(
                    vin=vin,
                    make=make,
                    model=model,
                    year=year
                )
            else:
                return VINDecodeResponse(vin=vin, error="Could not decode VIN")
    except Exception as e:
        logger.error(f"VIN decode error: {str(e)}")
        return VINDecodeResponse(vin=vin, error=str(e))

@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, update_data: VehicleUpdate, username: str = Depends(verify_token)):
    vehicle = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if update_dict:
        await db.vehicles.update_one({"_id": ObjectId(vehicle_id)}, {"$set": update_dict})
    
    updated_vehicle = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
    return Vehicle(**serialize_doc(updated_vehicle))

# Service Routes
@api_router.post("/services", response_model=Service)
async def create_service(service: ServiceCreate, username: str = Depends(verify_token)):
    # Verify vehicle exists
    vehicle = await db.vehicles.find_one({"_id": ObjectId(service.vehicle_id)})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    service_dict = service.dict()
    service_dict["customer_id"] = vehicle["customer_id"]
    service_dict["created_at"] = datetime.utcnow()
    
    if not service_dict.get("service_date"):
        service_dict["service_date"] = datetime.utcnow()
    
    result = await db.services.insert_one(service_dict)
    service_dict["id"] = str(result.inserted_id)
    del service_dict["_id"]
    
    return Service(**service_dict)

@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, update_data: ServiceUpdate, username: str = Depends(verify_token)):
    service = await db.services.find_one({"_id": ObjectId(service_id)})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if update_dict:
        await db.services.update_one({"_id": ObjectId(service_id)}, {"$set": update_dict})
    
    updated_service = await db.services.find_one({"_id": ObjectId(service_id)})
    return Service(**serialize_doc(updated_service))

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, username: str = Depends(verify_token)):
    result = await db.services.delete_one({"_id": ObjectId(service_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted successfully"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
