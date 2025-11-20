from collections import defaultdict

# Constants
RESOLUTION = 3600 * 8  # 8 hours in seconds
DATA_FILE = 'dataset/hospital-data.dat'
LABEL_FILE = 'dataset/hospital-labels.dat'
METADATA_FILE = 'dataset/hospital-metadata.txt'
OUTPUT_FILE = 'dataset/hospital-graph-data-periods.js'

# Initialize times
START_TIME = 0
END_TIME = 0
TOTAL_TIME = 0

# Read metadata to get START_TIME, END_TIME, and TOTAL_TIME
with open(METADATA_FILE, 'r') as file:
    data = file.readlines()
    START_TIME = int(data[0].split()[1])
    END_TIME = int(data[1].split()[1])
    TOTAL_TIME = int(data[2].split()[1])

print(f"Start time: {START_TIME}")
print(f"End time: {END_TIME}")
print(f"Total time: {TOTAL_TIME}")

# Generate time slices
TIME_SLICES = {}
period = 1

# Generate time slices without exceeding END_TIME
# each timeslice is named period 1 ... period n
TIME_SLICES = {}
period = 1
current_start_time = START_TIME

while current_start_time < END_TIME:
    current_end_time = min(current_start_time + RESOLUTION, END_TIME)  
    # Ensure we do not exceed END_TIME
    TIME_SLICES[f"period {period}"] = (current_start_time, current_end_time)
    
    # Move to the next period
    current_start_time += RESOLUTION
    period += 1

# Display the results
for period_name, time_range in TIME_SLICES.items():
    print(f"{period_name}: {time_range}")


# Time Period Mapping Strategy:
# --------------------------------------
# This program divides the full contact dataset into meaningful school day periods
# based on realistic Swedish high school scheduling.
# Each timestamp represents 20 seconds. The dataset spans two separate days:
# - Day 1: timestamps 0–1554
# - Day 2: timestamps 4301–5845
#
# We manually define each period (arrival, class, break, lunch, etc.)
# using timestamp ranges that reflect real durations:
# - Each class lasts exactly 1 hour 30 minutes (270 timestamps)
# - Breaks are 20 minutes (60 timestamps), lunch is 50 minutes (150 timestamps)
# - Arrival is ~35 minutes (105 timestamps), with a short "afterclass" phase
#
# This schedule structure allows us to label each edge (contact) with the 
# school period it occurred in, enabling time-aware network analysis.


def get_timeslice(ts):
    for period, (start, end) in TIME_SLICES.items():
        if start <= ts <= end:
            return period
    return "unknown"


def parse_group_file(filename):
    group_map = {}
    with open(filename, "r") as file:
        for line in file:
            parts = line.strip().split()
            if len(parts) != 2:
                continue
            node_id, group = parts[0], parts[1]
            group_map[node_id] = group
    return group_map


def main():
    edge_file = DATA_FILE
    group_file = LABEL_FILE
    output_file = OUTPUT_FILE

    nodes_set = set()
    edge_to_periods = defaultdict(set)

    # Read edge list with timestamps
    with open(edge_file, "r") as file:
        for line in file:
            parts = line.strip().split()
            if len(parts) != 3:
                continue
            # t i j format
            ts, src, tgt = parts
            ts = int(ts)
            period = get_timeslice(ts)
            edge = tuple(sorted((src, tgt)))
            edge_to_periods[edge].add(period)
            nodes_set.update([src, tgt])
    # print(edge_to_periods)     
    # Read group info
    group_map = parse_group_file(group_file)
    # print(group_map)

    # Create node list
    nodes = []
    for node_id in sorted(nodes_set):
        node = {
            "id": node_id,
            "label": node_id
        }
        if node_id in group_map:
            node["group"] = group_map[node_id]
        nodes.append(node)

    # Write JS output
    with open(output_file, "w") as js_file:
        js_file.write("export default {\n")

        # Nodes
        js_file.write("  nodes: [\n")
        for i, node in enumerate(nodes):
            parts = [f"id: '{node['id']}'", f"label: '{node['label']}'"]
            if "group" in node:
                parts.append(f"group: '{node['group']}'")
            line = "    { " + ", ".join(parts) + " }"
            if i < len(nodes) - 1:
                line += ","
            js_file.write(line + "\n")
        js_file.write("  ],\n")

        # Links with combined periods
        js_file.write("  links: [\n")
        all_edges = []
        for (src, tgt), periods in sorted(edge_to_periods.items()):
            period_list = "[" + ", ".join(f"'{p}'" for p in sorted(periods)) + "]"
            all_edges.append(f"    {{ source: '{src}', target: '{tgt}', periods: {period_list} }}")
        js_file.write(",\n".join(all_edges) + "\n")
        js_file.write("  ]\n")
        js_file.write("};\n")

if __name__ == "__main__":
    main()

# Why we store all periods in a single line per edge:
# --------------------------------------------------
# Each edge (source-target pair) may appear multiple times throughout the dataset
# during different periods (e.g., class1, break1, lunch, etc.).
#
# Instead of writing duplicate entries for the same edge per period,
# we aggregate all the periods into a single array:
#
#   { source: '1835', target: '1847', periods: ['afterclass', 'break1', ..., 'lunch'] }
#
# This design is more efficient:
# - It avoids redundancy (less file size, faster parsing)
# - It preserves the full temporal footprint of the interaction
# - It makes filtering by period easy in frontend code (e.g., edge['periods'].includes("class2"))
#
# It’s a compact, one-line-per-edge structure optimized for time-aware network visualizations.
