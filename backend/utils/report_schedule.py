"""
Utility functions for calculating report schedule times
"""
from datetime import datetime, timedelta
from typing import Optional

def calculate_next_run_at(
    frequency: str,
    frequency_day: Optional[int] = None,
    frequency_month: Optional[int] = None,
    scheduled_time: str = '02:00'
) -> datetime:
    """
    Calculate the next run time for a scheduled report based on frequency and schedule
    """
    now = datetime.now()
    hours, minutes = map(int, scheduled_time.split(':'))
    
    next_run = datetime.now().replace(hour=hours, minute=minutes, second=0, microsecond=0)
    
    if frequency == 'daily':
        # If time has passed today, schedule for tomorrow
        if next_run <= now:
            next_run = next_run + timedelta(days=1)
        return next_run
    
    elif frequency == 'weekly':
        # frequency_day: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        target_day = frequency_day if frequency_day is not None else now.weekday()
        current_day = now.weekday()
        days_until_target = (target_day - current_day + 7) % 7
        
        # If it's the target day but time has passed, schedule for next week
        if days_until_target == 0 and next_run <= now:
            days_until_target = 7
        
        next_run = next_run + timedelta(days=days_until_target)
        return next_run
    
    elif frequency == 'monthly':
        # frequency_day: 1-31 (day of month)
        target_day_of_month = frequency_day if frequency_day is not None else now.day
        current_day_of_month = now.day
        
        # Set the day first
        try:
            next_run = next_run.replace(day=target_day_of_month)
        except ValueError:
            # If day doesn't exist in current month (e.g., Feb 30), use last day of month
            # Move to next month and use last valid day
            if next_run.month == 12:
                next_run = next_run.replace(year=next_run.year + 1, month=1, day=1)
            else:
                next_run = next_run.replace(month=next_run.month + 1, day=1)
            # Get last day of that month
            from calendar import monthrange
            last_day = monthrange(next_run.year, next_run.month)[1]
            next_run = next_run.replace(day=min(target_day_of_month, last_day))
        
        if target_day_of_month < current_day_of_month:
            # Target day has passed this month, schedule for next month
            if next_run.month == 12:
                next_run = next_run.replace(year=next_run.year + 1, month=1)
            else:
                next_run = next_run.replace(month=next_run.month + 1)
            # Ensure day is valid in new month
            from calendar import monthrange
            last_day = monthrange(next_run.year, next_run.month)[1]
            next_run = next_run.replace(day=min(target_day_of_month, last_day))
        elif target_day_of_month == current_day_of_month:
            # Same day - check if time has passed
            if next_run <= now:
                if next_run.month == 12:
                    next_run = next_run.replace(year=next_run.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=next_run.month + 1)
                # Ensure day is valid in new month
                from calendar import monthrange
                last_day = monthrange(next_run.year, next_run.month)[1]
                next_run = next_run.replace(day=min(target_day_of_month, last_day))
        
        return next_run
    
    elif frequency == 'yearly':
        # frequency_month: 1-12 (January-December)
        # frequency_day: 1-31 (day of month)
        target_month = frequency_month if frequency_month is not None else now.month
        target_day_of_year = frequency_day if frequency_day is not None else now.day
        current_month = now.month
        current_day_of_year = now.day
        
        # Set month and day
        try:
            next_run = next_run.replace(month=target_month, day=target_day_of_year)
        except ValueError:
            # If day doesn't exist in target month, use last day of that month
            from calendar import monthrange
            last_day = monthrange(next_run.year, target_month)[1]
            next_run = next_run.replace(month=target_month, day=min(target_day_of_year, last_day))
        
        if (target_month < current_month or 
            (target_month == current_month and target_day_of_year < current_day_of_year) or 
            (target_month == current_month and target_day_of_year == current_day_of_year and next_run <= now)):
            # Target date has passed this year, schedule for next year
            next_run = next_run.replace(year=next_run.year + 1)
            # Ensure day is valid in target month of next year
            from calendar import monthrange
            last_day = monthrange(next_run.year, target_month)[1]
            next_run = next_run.replace(day=min(target_day_of_year, last_day))
        
        return next_run
    
    else:
        # Default to daily if frequency is not recognized
        if next_run <= now:
            next_run = next_run + timedelta(days=1)
        return next_run

