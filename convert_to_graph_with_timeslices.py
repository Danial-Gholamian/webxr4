from collections import defaultdict


# Time Period Mapping Strategy:
# --------------------------------------
# This program divides the full contact dataset into meaningful school-day periods
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


# Define school day periods in timestamp units
SCHEDULE = {
    "arrival": (0, 104),
    "class1": (105, 374),
    "break1": (375, 434),
    "class2": (435, 704),
    "lunch": (705, 854),
    "class3": (855, 1124),
    "break2": (1125, 1184),
    "class4": (1185, 1454),
    "afterclass": (1455, 1554),

    "arrival2": (4301, 4405),
    "class1_2": (4406, 4675),
    "break1_2": (4676, 4735),
    "class2_2": (4736, 5005),
    "lunch2": (5006, 5155),
    "class3_2": (5156, 5425),
    "break2_2": (5426, 5485),
    "class4_2": (5486, 5755),
    "afterclass2": (5756, 5845)
}


def get_timeslice(ts):
    for period, (start, end) in SCHEDULE.items():
        if start <= ts <= end:
            return period
    return "unknown"

def parse_group_file(filename):
    group_map = {}
    teacher_ids = set()
    with open(filename, "r") as file:
        for line in file:
            parts = line.strip().split()
            if len(parts) != 2:
                continue
            node_id, group = parts[0], parts[1]
            if group == "Teachers":
                teacher_ids.add(node_id)
            else:
                group_map[node_id] = group
    return group_map, teacher_ids

def main():
    edge_file = "primarySchool.dat"
    group_file = "student.dat"
    output_file = "graph-data-periods.js"

    nodes_set = set()
    edge_to_periods = defaultdict(set)

    # Read edge list with timestamps
    with open(edge_file, "r") as file:
        for line in file:
            parts = line.strip().split()
            if len(parts) != 3:
                continue
            src, tgt, ts = parts
            ts = int(ts)
            period = get_timeslice(ts)
            edge = tuple(sorted((src, tgt)))
            edge_to_periods[edge].add(period)
            nodes_set.update([src, tgt])

    # Read group info
    group_map, teacher_ids = parse_group_file(group_file)

    # Create node list
    nodes = []
    for node_id in sorted(nodes_set):
        node = {
            "id": node_id,
            "label": node_id
        }
        if node_id in teacher_ids:
            node["group"] = "Teachers"
            node["isTeacher"] = True
        elif node_id in group_map:
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
            if "isTeacher" in node:
                parts.append("isTeacher: true")
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
