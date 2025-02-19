from setuptools import setup, find_packages

setup(
    name="db_simulator",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        'SQLAlchemy',
        'PyYAML',
        'Faker',
        'numpy',
        'simpy>=4.0.0',
    ],
) 