# Open the input file and read data
input_file_path = 'dataset/Hospital.dat'

# t i j Si Sj -> time node#1 node#2 nodeId1 nodeId2
'''
 Each line has the form “t i j Si Sj“, where i and j are the anonymous IDs of
 the persons in contact, Si and Sj are their statuses (NUR=paramedical staff,
 i.e. nurses and nurses’ aides; PAT=Patient; MED=Medical doctor;
 ADM=administrative staff), and the interval during which this contact was
 active is [ t – 20s, t ].
'''

# Initialize dictionaries to track unique values of `i` and
# their corresponding `Si`
nodes_mapping = {}

# Prepare output lists for file content
t_i_j_lines = []
si_sj_lines = []

# Metadata
meta_data = {}
total_interactions = 0
total_seconds = 0
start_time = 0
end_time = 0


# Process the input data
with open(input_file_path, 'r') as file:
    for line in file:
        t, i, j, Si, Sj = line.strip().split('\t')

        # Store the time node#1 node#2 values
        t_i_j_lines.append(f"{t} {i} {j}")

        # Store unique mappings in dictionaries
        if i not in nodes_mapping:
            nodes_mapping[i] = Si
        if j not in nodes_mapping:
            nodes_mapping[j] = Sj

meta_data["start_time"] = int(t_i_j_lines[0].split()[0])
meta_data["end_time"] = int(t_i_j_lines[-1].split()[0])
meta_data["total_seconds"] = meta_data["end_time"] - meta_data["start_time"]
meta_data["total_interactions"] = len(t_i_j_lines)


# Write to the first .dat file (t, i, j) format
with open('dataset/hospital_data.dat', 'w') as node_data:
    node_data.write("\n".join(t_i_j_lines) + "\n")

# Sort the nodes_mapping by keys (IDs)
sorted_nodes = sorted(nodes_mapping.items())  # Sort by key (ID)

# Write to the second .dat file (i, Si) format after sorting
with open('dataset/hospital_labels.dat', 'w') as labels:
    for x, Sx in sorted_nodes:
        labels.write(f"{x} {Sx}\n")

with open('dataset/hospital-metadata.txt', 'w') as file:
    for x in meta_data:
        file.write(f"{x} {meta_data[x]} \n")
print("Files have been created: 'hospital-data.dat' and 'hospital-labels.dat'")
