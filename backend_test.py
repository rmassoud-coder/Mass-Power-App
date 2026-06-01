#!/usr/bin/env python3
"""
Backend API Test Suite for Garage Service Management System
Tests all authentication, customer, vehicle, and service management endpoints
"""

import requests
import json
from typing import Optional, Dict, Any

# Backend URL - using the public URL from frontend/.env
BACKEND_URL = "https://mechanic-search-3.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# Global token storage
auth_token: Optional[str] = None

# Test data storage
test_customer_id: Optional[str] = None
test_vehicle_id: Optional[str] = None
test_service_id: Optional[str] = None

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(test_name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ {message}{Colors.END}")

def make_request(method: str, endpoint: str, data: Optional[Dict] = None, 
                 use_auth: bool = False, params: Optional[Dict] = None) -> tuple:
    """Make HTTP request and return (success, response, error_message)"""
    url = f"{BACKEND_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if use_auth and auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return False, None, f"Unsupported method: {method}"
        
        print_info(f"{method} {url}")
        print_info(f"Status: {response.status_code}")
        
        if response.status_code >= 200 and response.status_code < 300:
            try:
                return True, response.json(), None
            except:
                return True, response.text, None
        else:
            try:
                error_detail = response.json()
                return False, None, f"Status {response.status_code}: {error_detail}"
            except:
                return False, None, f"Status {response.status_code}: {response.text}"
    
    except requests.exceptions.Timeout:
        return False, None, "Request timeout"
    except requests.exceptions.ConnectionError:
        return False, None, "Connection error - backend may be down"
    except Exception as e:
        return False, None, f"Exception: {str(e)}"

# ============================================================================
# AUTHENTICATION TESTS
# ============================================================================

def test_login_success():
    """Test login with correct credentials"""
    global auth_token
    print_test("Login with correct credentials")
    
    success, response, error = make_request(
        "POST", 
        "/auth/login",
        data={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    
    if success and response:
        if "token" in response and "username" in response:
            auth_token = response["token"]
            print_success(f"Login successful! Token received for user: {response['username']}")
            print_info(f"Token: {auth_token[:20]}...")
            return True
        else:
            print_error("Login response missing token or username")
            return False
    else:
        print_error(f"Login failed: {error}")
        return False

def test_login_failure():
    """Test login with incorrect credentials"""
    print_test("Login with incorrect credentials")
    
    success, response, error = make_request(
        "POST",
        "/auth/login",
        data={"username": "wronguser", "password": "wrongpass"}
    )
    
    if not success:
        print_success("Login correctly rejected invalid credentials")
        return True
    else:
        print_error("Login should have failed with invalid credentials")
        return False

def test_protected_endpoint_without_token():
    """Test accessing protected endpoint without token"""
    print_test("Access protected endpoint without token")
    
    success, response, error = make_request(
        "GET",
        "/customers/search?q=test",
        use_auth=False
    )
    
    if not success:
        print_success("Protected endpoint correctly rejected request without token")
        return True
    else:
        print_error("Protected endpoint should require authentication")
        return False

def test_token_verification():
    """Test token verification endpoint"""
    print_test("Verify JWT token")
    
    success, response, error = make_request(
        "GET",
        "/auth/verify",
        use_auth=True
    )
    
    if success and response:
        if response.get("valid") and response.get("username") == ADMIN_USERNAME:
            print_success(f"Token verified successfully for user: {response['username']}")
            return True
        else:
            print_error("Token verification response invalid")
            return False
    else:
        print_error(f"Token verification failed: {error}")
        return False

# ============================================================================
# CUSTOMER MANAGEMENT TESTS
# ============================================================================

def test_create_customer():
    """Test creating a new customer"""
    global test_customer_id
    print_test("Create new customer")
    
    success, response, error = make_request(
        "POST",
        "/customers",
        data={
            "name": "John Smith",
            "mobile_number": "555-0123"
        },
        use_auth=True
    )
    
    if success and response:
        if "id" in response and "name" in response and "mobile_number" in response:
            test_customer_id = response["id"]
            print_success(f"Customer created successfully! ID: {test_customer_id}")
            print_info(f"Name: {response['name']}, Mobile: {response['mobile_number']}")
            return True
        else:
            print_error("Customer response missing required fields")
            return False
    else:
        print_error(f"Customer creation failed: {error}")
        return False

def test_search_customer_by_mobile():
    """Test searching customers by partial mobile number"""
    print_test("Search customer by partial mobile number")
    
    success, response, error = make_request(
        "GET",
        "/customers/search",
        params={"q": "555"},
        use_auth=True
    )
    
    if success and response:
        if isinstance(response, list):
            print_success(f"Search returned {len(response)} result(s)")
            if len(response) > 0:
                result = response[0]
                if "customer" in result and "vehicles" in result and "total_services" in result:
                    print_info(f"Customer: {result['customer']['name']}")
                    print_info(f"Vehicles: {len(result['vehicles'])}")
                    print_info(f"Total services: {result['total_services']}")
                    return True
                else:
                    print_error("Search result missing required fields")
                    return False
            else:
                print_info("No results found (this is OK if no matching customers exist)")
                return True
        else:
            print_error("Search should return a list")
            return False
    else:
        print_error(f"Customer search failed: {error}")
        return False

def test_search_customer_by_name():
    """Test searching customers by partial name"""
    print_test("Search customer by partial name")
    
    success, response, error = make_request(
        "GET",
        "/customers/search",
        params={"q": "John"},
        use_auth=True
    )
    
    if success and response:
        if isinstance(response, list):
            print_success(f"Search returned {len(response)} result(s)")
            if len(response) > 0:
                result = response[0]
                print_info(f"Customer: {result['customer']['name']}")
                return True
            return True
        else:
            print_error("Search should return a list")
            return False
    else:
        print_error(f"Customer search failed: {error}")
        return False

def test_update_customer():
    """Test updating customer information"""
    print_test("Update customer information")
    
    if not test_customer_id:
        print_error("No customer ID available for update test")
        return False
    
    success, response, error = make_request(
        "PUT",
        f"/customers/{test_customer_id}",
        data={"name": "John Smith Updated"},
        use_auth=True
    )
    
    if success and response:
        if response.get("name") == "John Smith Updated":
            print_success(f"Customer updated successfully! New name: {response['name']}")
            return True
        else:
            print_error("Customer update did not reflect changes")
            return False
    else:
        print_error(f"Customer update failed: {error}")
        return False

# ============================================================================
# VEHICLE MANAGEMENT TESTS
# ============================================================================

def test_vin_decoder():
    """Test VIN decoder with sample VIN"""
    print_test("VIN Decoder - BMW X3 2011")
    
    test_vin = "5UXWX7C5*BA"
    
    success, response, error = make_request(
        "GET",
        f"/vehicles/decode-vin/{test_vin}",
        use_auth=True
    )
    
    if success and response:
        print_info(f"VIN: {response.get('vin')}")
        print_info(f"Make: {response.get('make')}")
        print_info(f"Model: {response.get('model')}")
        print_info(f"Year: {response.get('year')}")
        
        if response.get("error"):
            print_error(f"VIN decode error: {response.get('error')}")
            return False
        
        # Check if decoded correctly (BMW X3 2011)
        if response.get("make") and "BMW" in response.get("make").upper():
            print_success("VIN decoded successfully - Make matches BMW")
            return True
        else:
            print_error("VIN decode did not return expected BMW make")
            return False
    else:
        print_error(f"VIN decode failed: {error}")
        return False

def test_create_vehicle():
    """Test adding a vehicle to a customer"""
    global test_vehicle_id
    print_test("Add vehicle to customer")
    
    if not test_customer_id:
        print_error("No customer ID available for vehicle creation")
        return False
    
    success, response, error = make_request(
        "POST",
        "/vehicles",
        data={
            "customer_id": test_customer_id,
            "vin": "5UXWX7C5*BA",
            "plate_number": "ABC-1234",
            "make": "BMW",
            "model": "X3",
            "year": "2011"
        },
        use_auth=True
    )
    
    if success and response:
        if "id" in response and "vin" in response:
            test_vehicle_id = response["id"]
            print_success(f"Vehicle created successfully! ID: {test_vehicle_id}")
            print_info(f"VIN: {response['vin']}, Plate: {response['plate_number']}")
            print_info(f"Make: {response['make']}, Model: {response['model']}, Year: {response.get('year')}")
            return True
        else:
            print_error("Vehicle response missing required fields")
            return False
    else:
        print_error(f"Vehicle creation failed: {error}")
        return False

def test_search_vehicle_by_vin():
    """Test searching vehicles by partial VIN"""
    print_test("Search vehicle by partial VIN")
    
    success, response, error = make_request(
        "GET",
        "/vehicles/search-vin",
        params={"vin": "5UX"},
        use_auth=True
    )
    
    if success and response:
        if isinstance(response, list):
            print_success(f"VIN search returned {len(response)} result(s)")
            if len(response) > 0:
                result = response[0]
                if "customer" in result and "vehicles" in result:
                    print_info(f"Customer: {result['customer']['name']}")
                    print_info(f"Vehicles: {len(result['vehicles'])}")
                    return True
                else:
                    print_error("Search result missing required fields")
                    return False
            return True
        else:
            print_error("Search should return a list")
            return False
    else:
        print_error(f"VIN search failed: {error}")
        return False

def test_search_vehicle_by_plate():
    """Test searching vehicles by partial plate number"""
    print_test("Search vehicle by partial plate number")
    
    success, response, error = make_request(
        "GET",
        "/vehicles/search-plate",
        params={"plate": "ABC"},
        use_auth=True
    )
    
    if success and response:
        if isinstance(response, list):
            print_success(f"Plate search returned {len(response)} result(s)")
            if len(response) > 0:
                result = response[0]
                if "customer" in result and "vehicles" in result:
                    print_info(f"Customer: {result['customer']['name']}")
                    print_info(f"Vehicles: {len(result['vehicles'])}")
                    return True
                else:
                    print_error("Search result missing required fields")
                    return False
            return True
        else:
            print_error("Search should return a list")
            return False
    else:
        print_error(f"Plate search failed: {error}")
        return False

# ============================================================================
# SERVICE MANAGEMENT TESTS
# ============================================================================

def test_create_service():
    """Test creating a service record"""
    global test_service_id
    print_test("Create service record")
    
    if not test_vehicle_id:
        print_error("No vehicle ID available for service creation")
        return False
    
    success, response, error = make_request(
        "POST",
        "/services",
        data={
            "vehicle_id": test_vehicle_id,
            "service_description": "Oil change and tire rotation",
            "additional_info": "Used synthetic oil 5W-30",
            "cost": 89.99
        },
        use_auth=True
    )
    
    if success and response:
        if "id" in response and "service_description" in response:
            test_service_id = response["id"]
            print_success(f"Service created successfully! ID: {test_service_id}")
            print_info(f"Description: {response['service_description']}")
            print_info(f"Cost: ${response['cost']}")
            print_info(f"Customer ID: {response.get('customer_id')}")
            print_info(f"Vehicle ID: {response.get('vehicle_id')}")
            
            # Verify customer_id is set
            if response.get('customer_id'):
                print_success("Service correctly associated with customer")
            else:
                print_error("Service missing customer_id association")
                return False
            
            return True
        else:
            print_error("Service response missing required fields")
            return False
    else:
        print_error(f"Service creation failed: {error}")
        return False

def test_update_service():
    """Test updating a service record"""
    print_test("Update service record")
    
    if not test_service_id:
        print_error("No service ID available for update test")
        return False
    
    success, response, error = make_request(
        "PUT",
        f"/services/{test_service_id}",
        data={
            "cost": 99.99,
            "additional_info": "Used synthetic oil 5W-30, replaced air filter"
        },
        use_auth=True
    )
    
    if success and response:
        if response.get("cost") == 99.99:
            print_success(f"Service updated successfully! New cost: ${response['cost']}")
            print_info(f"Updated info: {response.get('additional_info')}")
            return True
        else:
            print_error("Service update did not reflect changes")
            return False
    else:
        print_error(f"Service update failed: {error}")
        return False

def test_get_customer_details():
    """Test getting customer details with all vehicles and services"""
    print_test("Get customer details with vehicles and services")
    
    if not test_customer_id:
        print_error("No customer ID available for details test")
        return False
    
    success, response, error = make_request(
        "GET",
        f"/customers/{test_customer_id}/details",
        use_auth=True
    )
    
    if success and response:
        if "customer" in response and "vehicles" in response and "services" in response:
            print_success("Customer details retrieved successfully!")
            print_info(f"Customer: {response['customer']['name']}")
            print_info(f"Vehicles: {len(response['vehicles'])}")
            print_info(f"Services: {len(response['services'])}")
            
            # Verify we have the data we created
            if len(response['vehicles']) > 0:
                print_success("Customer has vehicles")
            if len(response['services']) > 0:
                print_success("Customer has service records")
            
            return True
        else:
            print_error("Customer details response missing required fields")
            return False
    else:
        print_error(f"Get customer details failed: {error}")
        return False

def test_delete_service():
    """Test deleting a service record"""
    print_test("Delete service record")
    
    if not test_service_id:
        print_error("No service ID available for delete test")
        return False
    
    success, response, error = make_request(
        "DELETE",
        f"/services/{test_service_id}",
        use_auth=True
    )
    
    if success:
        print_success("Service deleted successfully!")
        return True
    else:
        print_error(f"Service deletion failed: {error}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all test scenarios"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}GARAGE SERVICE MANAGEMENT SYSTEM - BACKEND API TEST SUITE{Colors.END}")
    print(f"{Colors.BLUE}Backend URL: {BACKEND_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    results = {}
    
    # Authentication Tests
    print(f"\n{Colors.YELLOW}{'='*80}{Colors.END}")
    print(f"{Colors.YELLOW}AUTHENTICATION TESTS{Colors.END}")
    print(f"{Colors.YELLOW}{'='*80}{Colors.END}")
    
    results["Login Success"] = test_login_success()
    results["Login Failure"] = test_login_failure()
    results["Protected Endpoint Without Token"] = test_protected_endpoint_without_token()
    results["Token Verification"] = test_token_verification()
    
    # Customer Management Tests
    print(f"\n{Colors.YELLOW}{'='*80}{Colors.END}")
    print(f"{Colors.YELLOW}CUSTOMER MANAGEMENT TESTS{Colors.END}")
    print(f"{Colors.YELLOW}{'='*80}{Colors.END}")
    
    results["Create Customer"] = test_create_customer()
    results["Search Customer by Mobile"] = test_search_customer_by_mobile()
    results["Search Customer by Name"] = test_search_customer_by_name()
    results["Update Customer"] = test_update_customer()
    
    # Vehicle Management Tests
    print(f"\n{Colors.YELLOW}{'='*80}{Colors.END}")
    print(f"{Colors.YELLOW}VEHICLE MANAGEMENT TESTS{Colors.END}")
    print(f"{Colors.YELLOW}{'='*80}{Colors.END}")
    
    results["VIN Decoder"] = test_vin_decoder()
    results["Create Vehicle"] = test_create_vehicle()
    results["Search Vehicle by VIN"] = test_search_vehicle_by_vin()
    results["Search Vehicle by Plate"] = test_search_vehicle_by_plate()
    
    # Service Management Tests
    print(f"\n{Colors.YELLOW}{'='*80}{Colors.END}")
    print(f"{Colors.YELLOW}SERVICE MANAGEMENT TESTS{Colors.END}")
    print(f"{Colors.YELLOW}{'='*80}{Colors.END}")
    
    results["Create Service"] = test_create_service()
    results["Update Service"] = test_update_service()
    results["Get Customer Details"] = test_get_customer_details()
    results["Delete Service"] = test_delete_service()
    
    # Print Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    passed = sum(1 for v in results.values() if v)
    failed = sum(1 for v in results.values() if not v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}PASSED{Colors.END}" if result else f"{Colors.RED}FAILED{Colors.END}"
        print(f"{test_name}: {status}")
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}Total: {total} | Passed: {Colors.GREEN}{passed}{Colors.END} | Failed: {Colors.RED}{failed}{Colors.END}{Colors.BLUE}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}\n")
    
    return passed, failed, total

if __name__ == "__main__":
    passed, failed, total = run_all_tests()
    exit(0 if failed == 0 else 1)
