# Open the input file and read data
input_file_path = 'hospital.dat'

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
t_ij_lines = []
si_sj_lines = []

# Process the input data
with open(input_file_path, 'r') as file:
    for line in file:
        t, i, j, Si, Sj = line.strip().split('\t')

        # Store the time node#1 node#2 values
        t_ij_lines.append(f"{t} {i} {j}")

        # Store unique mappings in dictionaries
        if i not in nodes_mapping:
            nodes_mapping[i] = Si
        if j not in nodes_mapping:
            nodes_mapping[j] = Sj

# Write to the first .dat file (t, i, j) format
with open('hospital.dat', 'w') as f_t_ij:
    f_t_ij.write("\n".join(t_ij_lines) + "\n")

# Write to the second .dat file (i, Si) and (j, Sj) format
with open('file_si_sj.dat', 'w') as f_si_sj:
    f_si_sj.write("\n".join(f"{i} {Si}" for i, Si in nodes_mapping.items()) + "\n")
    f_si_sj.write("\n".join(f"{j} {Sj}" for j, Sj in nodes_mapping.items()) + "\n")

print("Files have been created: 'file_t_ij.dat' and 'file_si_sj.dat'")