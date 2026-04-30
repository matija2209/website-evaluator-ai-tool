import pandas as pd
import os

input_file = 'input/slovenian_ecommerces.csv'
recovered_file = 'output/bizi-profile-recovered.csv'

if not os.path.exists(input_file) or not os.path.exists(recovered_file):
    print("Files missing")
    exit(1)

df_input = pd.read_csv(input_file)
df_recovered = pd.read_csv(recovered_file)

# Normalize names for matching
df_input['clean_name'] = df_input['Title'].str.lower().str.strip()
df_recovered['clean_name'] = df_recovered['Title'].str.lower().str.strip()

# Match on Title
merged = pd.merge(df_input, df_recovered[['clean_name', 'website', 'email']], on='clean_name', how='left')

found = merged['website'].notna().sum()
total = len(merged)

print(f"Total companies in input: {total}")
print(f"Companies found in recovered results: {found} ({found/total*100:.2f}%)")

# Show some missing ones
missing = merged[merged['website'].isna()]['Title'].head(10).tolist()
if missing:
    print("\nSample missing companies:")
    for m in missing:
      print(f"- {m}")
