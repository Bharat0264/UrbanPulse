from datetime import date
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, model_validator

class Filters(BaseModel):
    start: Optional[date] = None
    end: Optional[date] = None
    borough: Optional[Literal['Manhattan','Brooklyn','Queens','Bronx','Staten Island','EWR']] = None
    zone: Optional[int] = Field(None, ge=1, le=263)
    hour_start: int = Field(0, ge=0, le=23)
    hour_end: int = Field(23, ge=0, le=23)
    day_type: Literal['all','weekday','weekend'] = 'all'
    direction: Literal['pickup','dropoff'] = 'pickup'
    limit: int = Field(20, ge=1, le=100)
    @model_validator(mode='after')
    def ordered(self):
        if self.start and self.end and self.start > self.end:
            raise ValueError('Start date must precede end date')
        if self.hour_start > self.hour_end:
            raise ValueError('Hour start must precede hour end')
        return self

class TableResponse(BaseModel):
    rows: list[dict[str, Any]]
    filters: Filters
    units: str

class Overview(BaseModel):
    trips: int
    fares: float
    distance: float
    duration: float
    top_zone: Optional[str]
    peak_hour: Optional[int]
    stories: list[dict[str, Any]]
    filters: Filters

class RecentDemand(BaseModel):
    time: str
    actual: float

class ForecastResponse(BaseModel):
    zone: int
    timestamp: str
    prediction: float = Field(ge=0)
    baseline: float = Field(ge=0)
    scope: str
    recent: list[RecentDemand]
    evaluation: list[dict[str, Any]]

class DatasetMetadata(BaseModel):
    model_config = {'extra':'allow'}
    dataset_id: str
    source: str
    mode: Literal['sample','full']
    months: list[str]
    input_rows: int
    cleaned_rows: int
    rejected_rows: int
    aggregate_rows: int
    duration_seconds: float
    start: str
    end: str
    spark_version: str
    status: Literal['completed']
