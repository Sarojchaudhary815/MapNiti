from sqlalchemy import Column, Integer, String, Text
from app.database import Base

class Vacancy(Base):
    __tablename__ = "vacancies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200)) # Senior GIS Analyst
    description = Column(Text)
    posted_date = Column(String(50))