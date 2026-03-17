from collections import defaultdict

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
    edge_file = "dataset/primarySchool/primarySchool.dat"
    group_file = "dataset/primarySchool/student.dat"
    output_file = "graph-data-times.js"

    nodes_set = set()
    edge_to_times = defaultdict(list)
    max_ts = -1

    # Read edge list with timestamps
    with open(edge_file, "r") as file:
        for line in file:
            parts = line.strip().split()
            if len(parts) != 3:
                continue
            src, tgt, ts = parts
            ts = int(ts)

            edge = tuple(sorted((src, tgt)))
            edge_to_times[edge].append(ts)
            nodes_set.update([src, tgt])

            if ts > max_ts:
                max_ts = ts

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

        # Meta (T = max timestamp seen)
        js_file.write(f"  meta: {{ T: {max_ts} }},\n")

        # Links with timestamps
        js_file.write("  links: [\n")
        all_edges = []
        for (src, tgt), times in sorted(edge_to_times.items()):
            times_sorted = sorted(times)
            times_list = "[" + ", ".join(str(t) for t in times_sorted) + "]"
            all_edges.append(f"    {{ source: '{src}', target: '{tgt}', times: {times_list} }}")
        js_file.write(",\n".join(all_edges) + "\n")
        js_file.write("  ]\n")
        js_file.write("};\n")

if __name__ == "__main__":
    main()
