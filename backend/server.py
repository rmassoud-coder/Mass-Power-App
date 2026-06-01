from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Pydantic Models
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


def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


# Initialize indexes on startup
@app.on_event("startup")
async def startup_db():
    await db.customers.create_index("mobile_number")
    await db.vehicles.create_index("vin")
    await db.vehicles.create_index("plate_number")
    await db.vehicles.create_index("customer_id")
    await db.services.create_index("vehicle_id")
    await db.services.create_index("customer_id")
    logger.info("Database indexes created")


# Customer Routes
@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate):
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
async def search_customers(q: str):
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
async def get_customer_details(customer_id: str):
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
async def update_customer(customer_id: str, update_data: CustomerUpdate):
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    if update_dict:
        await db.customers.update_one({"_id": ObjectId(customer_id)}, {"$set": update_dict})
    
    updated_customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    return Customer(**serialize_doc(updated_customer))

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Delete all services for this customer
    await db.services.delete_many({"customer_id": customer_id})
    # Delete all vehicles for this customer
    await db.vehicles.delete_many({"customer_id": customer_id})
    # Delete the customer
    await db.customers.delete_one({"_id": ObjectId(customer_id)})
    
    return {"message": "Customer and all associated records deleted successfully"}


# Vehicle Routes
@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle: VehicleCreate):
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
async def search_by_vin(vin: str):
    vehicles = await db.vehicles.find({"vin": {"$regex": vin, "$options": "i"}}).to_list(100)
    
    results = []
    seen_customers = set()
    for vehicle in vehicles:
        customer_id = vehicle["customer_id"]
        if customer_id in seen_customers:
            continue
        seen_customers.add(customer_id)
        
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        if customer:
            all_vehicles = await db.vehicles.find({"customer_id": customer_id}).to_list(100)
            services_count = await db.services.count_documents({"customer_id": customer_id})
            results.append(SearchResult(
                customer=Customer(**serialize_doc(customer)),
                vehicles=[Vehicle(**serialize_doc(v)) for v in all_vehicles],
                total_services=services_count
            ))
    
    return results

@api_router.get("/vehicles/search-plate")
async def search_by_plate(plate: str):
    vehicles = await db.vehicles.find({"plate_number": {"$regex": plate, "$options": "i"}}).to_list(100)
    
    results = []
    seen_customers = set()
    for vehicle in vehicles:
        customer_id = vehicle["customer_id"]
        if customer_id in seen_customers:
            continue
        seen_customers.add(customer_id)
        
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        if customer:
            all_vehicles = await db.vehicles.find({"customer_id": customer_id}).to_list(100)
            services_count = await db.services.count_documents({"customer_id": customer_id})
            results.append(SearchResult(
                customer=Customer(**serialize_doc(customer)),
                vehicles=[Vehicle(**serialize_doc(v)) for v in all_vehicles],
                total_services=services_count
            ))
    
    return results

@api_router.get("/vehicles/decode-vin/{vin}", response_model=VINDecodeResponse)
async def decode_vin(vin: str):
    """Decode VIN using NHTSA API"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as http_client:
            response = await http_client.get(f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json")
            data = response.json()
            
            if "Results" in data:
                results = data["Results"]
                make = next((r["Value"] for r in results if r["Variable"] == "Make" and r["Value"]), None)
                model = next((r["Value"] for r in results if r["Variable"] == "Model" and r["Value"]), None)
                year = next((r["Value"] for r in results if r["Variable"] == "Model Year" and r["Value"]), None)
                
                return VINDecodeResponse(vin=vin, make=make, model=model, year=year)
            else:
                return VINDecodeResponse(vin=vin, error="Could not decode VIN")
    except Exception as e:
        logger.error(f"VIN decode error: {str(e)}")
        return VINDecodeResponse(vin=vin, error=str(e))

@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, update_data: VehicleUpdate):
    vehicle = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if update_dict:
        await db.vehicles.update_one({"_id": ObjectId(vehicle_id)}, {"$set": update_dict})
    
    updated_vehicle = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
    return Vehicle(**serialize_doc(updated_vehicle))

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    vehicle = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Delete all services for this vehicle
    await db.services.delete_many({"vehicle_id": vehicle_id})
    # Delete the vehicle
    await db.vehicles.delete_one({"_id": ObjectId(vehicle_id)})
    
    return {"message": "Vehicle and all associated services deleted successfully"}


# Service Routes
@api_router.post("/services", response_model=Service)
async def create_service(service: ServiceCreate):
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
async def update_service(service_id: str, update_data: ServiceUpdate):
    service = await db.services.find_one({"_id": ObjectId(service_id)})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if update_dict:
        await db.services.update_one({"_id": ObjectId(service_id)}, {"$set": update_dict})
    
    updated_service = await db.services.find_one({"_id": ObjectId(service_id)})
    return Service(**serialize_doc(updated_service))

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    result = await db.services.delete_one({"_id": ObjectId(service_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted successfully"}


# Report Routes
class ReportItem(BaseModel):
    service_id: str
    customer_id: str
    customer_name: str
    customer_mobile: str
    vehicle_id: str
    vehicle_make: str
    vehicle_model: str
    vehicle_year: Optional[str] = None
    vehicle_vin: str
    vehicle_plate: str
    service_description: str
    additional_info: Optional[str] = None
    cost: float
    service_date: datetime

class ReportResponse(BaseModel):
    items: List[ReportItem]
    total_cost: float
    total_services: int

@api_router.get("/reports/services", response_model=ReportResponse)
async def services_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    mobile: Optional[str] = None,
    vin: Optional[str] = None,
    plate: Optional[str] = None,
):
    """Get services report filtered by date range and optionally by customer/vehicle"""
    # Build service query
    service_query: dict = {}
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            service_query.setdefault("service_date", {})["$gte"] = start_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            service_query.setdefault("service_date", {})["$lte"] = end_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    # Filter customers if mobile provided
    if mobile:
        matching_customers = await db.customers.find(
            {"mobile_number": {"$regex": mobile, "$options": "i"}}
        ).to_list(1000)
        customer_ids = [str(c["_id"]) for c in matching_customers]
        if not customer_ids:
            return ReportResponse(items=[], total_cost=0, total_services=0)
        service_query["customer_id"] = {"$in": customer_ids}

    # Filter vehicles if vin or plate provided
    if vin or plate:
        vehicle_filter: dict = {}
        if vin:
            vehicle_filter["vin"] = {"$regex": vin, "$options": "i"}
        if plate:
            vehicle_filter["plate_number"] = {"$regex": plate, "$options": "i"}
        matching_vehicles = await db.vehicles.find(vehicle_filter).to_list(1000)
        vehicle_ids = [str(v["_id"]) for v in matching_vehicles]
        if not vehicle_ids:
            return ReportResponse(items=[], total_cost=0, total_services=0)
        service_query["vehicle_id"] = {"$in": vehicle_ids}

    # Fetch services
    services = await db.services.find(service_query).sort("service_date", -1).to_list(10000)

    # Enrich each service with customer + vehicle data
    items = []
    total_cost = 0.0
    for service in services:
        customer = await db.customers.find_one({"_id": ObjectId(service["customer_id"])})
        vehicle = await db.vehicles.find_one({"_id": ObjectId(service["vehicle_id"])})
        if not customer or not vehicle:
            continue

        items.append(ReportItem(
            service_id=str(service["_id"]),
            customer_id=service["customer_id"],
            customer_name=customer["name"],
            customer_mobile=customer["mobile_number"],
            vehicle_id=service["vehicle_id"],
            vehicle_make=vehicle["make"],
            vehicle_model=vehicle["model"],
            vehicle_year=vehicle.get("year"),
            vehicle_vin=vehicle["vin"],
            vehicle_plate=vehicle["plate_number"],
            service_description=service["service_description"],
            additional_info=service.get("additional_info"),
            cost=service["cost"],
            service_date=service["service_date"],
        ))
        total_cost += service["cost"]

    return ReportResponse(items=items, total_cost=total_cost, total_services=len(items))


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
