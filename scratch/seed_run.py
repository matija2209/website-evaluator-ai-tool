import pandas as pd
import os

input_file = 'input/slovenian_ecommerces.csv'
recovered_file = 'output/bizi-profile-recovered.csv'
run_id = '20260428_full'
run_dir = f'runs/{run_id}'

df_input = pd.read_csv(input_file)
df_recovered = pd.read_csv(recovered_file)

# Normalize names for matching
df_input['clean_name'] = df_input['Title'].str.lower().str.strip()
df_recovered['clean_name'] = df_recovered['Title'].str.lower().str.strip()

# Match on Title
merged = pd.merge(df_input, df_recovered[['clean_name', 'website', 'email']], on='clean_name', how='left')

# Rename columns to match project schema
merged.rename(columns={
    'Title': 'Company_Name', 
    'website': 'Discovered_Website', 
    'Activity Description': 'activityDescription',
    'URL': 'Original_URL'
}, inplace=True)

# Define all required columns
cols = [
    'Company_Name', 'Cleaned_Name', 'City', 'Normalized_City', 'Original_URL', 
    'Discovered_Website', 'Search_Status', 'Search_Query', 'Search_Error', 
    'SERP_Position', 'AI_Confidence', 'AI_Reasoning', 'Tokens_Used', 
    'Multiple_Valid_Found', 'Processing_Date', 'Screenshot_Status', 
    'Desktop_Sections', 'Mobile_Sections', 'Screenshot_Error', 
    'Load_Time_MS', 'Screenshot_Retry_Count', 'Screenshot_Timestamp',
    'activityDescription' # Added for AI analysis later
]

# Fill missing columns with defaults
for col in cols:
    if col not in merged.columns:
        merged[col] = ''

merged['Search_Status'] = 'WEBSITE_DISCOVERED'
merged['Screenshot_Status'] = 'PENDING'
merged['Processing_Date'] = pd.Timestamp.now().isoformat()

# Filter out rows with no website discovered
merged = merged[merged['Discovered_Website'].notna()]
merged = merged[merged['Discovered_Website'] != '']

os.makedirs(run_dir, exist_ok=True)
os.makedirs(os.path.join(run_dir, 'screenshots'), exist_ok=True)

merged[cols].to_csv(os.path.join(run_dir, 'website-discovery-progress.csv'), index=False)
print(f"Seeded {len(merged)} companies into {run_dir}")
