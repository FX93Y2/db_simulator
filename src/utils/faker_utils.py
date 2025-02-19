from typing import Any, Optional
from faker import Faker

# Initialize Faker with a fixed seed for reproducibility
fake = Faker()
Faker.seed(42)

def generate_fake_data(method: str, size: Optional[int] = None) -> Any:
    """Generate fake data using Faker based on method name"""
    faker_method = getattr(fake, method, None)
    if faker_method is None:
        raise ValueError(f"Unsupported Faker method: {method}")
    
    if size is None:
        return faker_method()
    
    return [faker_method() for _ in range(size)]