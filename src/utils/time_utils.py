from datetime import datetime, timedelta
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)

def calculate_work_end_time(
    start_time: datetime,
    total_hours: float,
    hours_per_day: int,
    start_hour: int,
    end_hour: int,
    work_days: List[int]
) -> datetime:
    """Calculate the end time of work considering work schedule constraints."""
    remaining_hours = total_hours
    current_time = start_time
    
    while remaining_hours > 0:
        # Skip non-working days
        while current_time.weekday() + 1 not in work_days:
            current_time = (current_time + timedelta(days=1)).replace(
                hour=start_hour, minute=0, second=0
            )
            
        # Calculate available hours for current day
        day_start = max(
            current_time,
            current_time.replace(hour=start_hour, minute=0, second=0)
        )
        day_end = current_time.replace(hour=end_hour, minute=0, second=0)
        
        available_hours = min(
            (day_end - day_start).total_seconds() / 3600,
            hours_per_day,
            remaining_hours
        )
        
        if available_hours <= 0:
            current_time = (current_time + timedelta(days=1)).replace(
                hour=start_hour, minute=0, second=0
            )
            continue
            
        current_time = day_start + timedelta(hours=available_hours)
        remaining_hours -= available_hours
        
        if current_time.hour >= end_hour:
            current_time = (current_time + timedelta(days=1)).replace(
                hour=start_hour, minute=0, second=0
            )
            
    return current_time

def calculate_working_hours(
    start_time: datetime,
    end_time: datetime,
    hours_per_day: int,
    start_hour: int,
    end_hour: int,
    work_days: List[int]
) -> float:
    """Calculate actual working hours between two timestamps."""
    periods = get_working_periods(
        start_time, end_time, hours_per_day, 
        start_hour, end_hour, work_days
    )
    
    total_hours = 0.0
    for period_start, period_end in periods:
        hours = (period_end - period_start).total_seconds() / 3600
        total_hours += min(hours, hours_per_day)
        
    return total_hours

def get_working_periods(
    start_time: datetime,
    end_time: datetime,
    hours_per_day: int,
    start_hour: int,
    end_hour: int,
    work_days: List[int]
) -> List[Tuple[datetime, datetime]]:
    """Get list of actual working periods between start and end time."""
    periods = []
    current_time = start_time
    
    while current_time < end_time:
        if current_time.weekday() + 1 not in work_days:
            current_time = (current_time + timedelta(days=1)).replace(
                hour=start_hour, minute=0, second=0
            )
            continue
            
        period_start = max(
            current_time,
            current_time.replace(hour=start_hour, minute=0, second=0)
        )
        period_end = min(
            end_time,
            current_time.replace(hour=end_hour, minute=0, second=0)
        )
        
        if period_end > period_start:
            periods.append((period_start, period_end))
        
        current_time = (current_time + timedelta(days=1)).replace(
            hour=start_hour, minute=0, second=0
        )
        
    return periods

def validate_work_schedule(
    schedule: dict,
    simulation_start: datetime,
    simulation_end: datetime
) -> bool:
    """Validate work schedule configuration."""
    try:
        hours_per_day = schedule.get('hours_per_day', 8)
        start_hour = schedule.get('start_hour', 9)
        end_hour = schedule.get('end_hour', 17)
        work_days = schedule.get('work_days', [1, 2, 3, 4, 5])
        
        if not (0 <= start_hour < 24 and 0 <= end_hour <= 24):
            logger.error("Invalid work hours specified")
            return False
        if end_hour <= start_hour:
            logger.error("End hour must be after start hour")
            return False
        if hours_per_day > (end_hour - start_hour):
            logger.error("Hours per day cannot exceed work day length")
            return False
        if not work_days or not all(1 <= d <= 7 for d in work_days):
            logger.error("Invalid work days specified")
            return False
            
        total_hours = calculate_working_hours(
            simulation_start,
            simulation_end,
            hours_per_day,
            start_hour,
            end_hour,
            work_days
        )
        
        return total_hours > 0
        
    except Exception as e:
        logger.error(f"Work schedule validation failed: {str(e)}")
        return False