from collections import defaultdict

# Define school day periods in timestamp units
SCHEDULE = {
    "arrival": (0, 30),
    "class1": (31, 120),
    "break1": (121, 150),
    "class2": (151, 240),
    "lunch": (241, 330),
    "class3": (331, 420),
    "break2": (421, 450),
    "afterclass": (451, 5845)
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
