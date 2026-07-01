import pandas as pd
import csv

def load_crop_state_subset(path, crop, state):
    """
    Memory-efficient CSV loader. Streams the CSV line-by-line and filters
    rows for the specific crop and state BEFORE loading into pandas,
    reducing memory consumption from 500MB+ to under 5MB.
    """
    rows = []
    # Strip target values for robust matching
    target_crop = str(crop).strip()
    target_state = str(state).strip()
    
    with open(path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            c = row.get("Commodity")
            s = row.get("State")
            if c is not None and s is not None:
                if str(c).strip() == target_crop and str(s).strip() == target_state:
                    rows.append(row)
                
    df = pd.DataFrame(rows)
    if df.empty:
        return df

    # Standard clean-up & type conversions to match backend format
    df.rename(columns={
        "Market Name": "mandi",
        "Commodity": "crop",
        "Modal Price (Rs./Quintal)": "price",
        "Min Price (Rs./Quintal)": "min_price",
        "Max Price (Rs./Quintal)": "max_price",
        "Price Date": "date",
        "State": "state"
    }, inplace=True)

    df['date'] = pd.to_datetime(df['date'], dayfirst=True, errors='coerce')
    df['price'] = pd.to_numeric(df['price'], errors='coerce')
    df['min_price'] = pd.to_numeric(df['min_price'], errors='coerce')
    df['max_price'] = pd.to_numeric(df['max_price'], errors='coerce')

    # Keep only rows with required values for training/inference.
    df = df.dropna(subset=['date', 'crop', 'state', 'mandi', 'price'])
    df = df.sort_values('date')

    return df
