from collections import defaultdict


input_file = "dataset/hospital/Hospital.dat"
output_file = "dataset/hospital/graph-data-times.js"


# Role mapping
role_map = {
    "NUR": "Nurse",
    "PAT": "Patient",
    "MED": "Doctor",
    "ADM": "Admin"
}

nodes = {}
edge_to_times = defaultdict(list)
max_ts = -1

with open(input_file, "r") as file:
    for line in file:

        parts = line.strip().split()

        if len(parts) != 5:
            continue

        t, i, j, Si, Sj = parts
        t = int(t)

        # convert role codes to readable roles
        nodes[i] = role_map.get(Si, Si)
        nodes[j] = role_map.get(Sj, Sj)

        # store undirected edge
        edge = tuple(sorted((i, j)))
        edge_to_times[edge].append(t)

        if t > max_ts:
            max_ts = t

with open(output_file, "w") as js_file:

    js_file.write("export default {\n")

    # Nodes
    js_file.write("  nodes: [\n")

    node_list = sorted(nodes.items())

    for idx, (node_id, role) in enumerate(node_list):

        line = f"    {{ id: '{node_id}', label: '{node_id}', group: '{role}' }}"

        if idx < len(node_list) - 1:
            line += ","

        js_file.write(line + "\n")

    js_file.write("  ],\n")

    # Meta
    js_file.write(f"  meta: {{ T: {max_ts} }},\n")

    # Links
    js_file.write("  links: [\n")

    edges = []

    for (src, tgt), times in sorted(edge_to_times.items()):

        times_sorted = sorted(times)
        times_str = "[" + ", ".join(map(str, times_sorted)) + "]"

        edges.append(
            f"    {{ source: '{src}', target: '{tgt}', times: {times_str} }}"
        )

    js_file.write(",\n".join(edges))
    js_file.write("\n")

    js_file.write("  ]\n")
    js_file.write("};\n")

