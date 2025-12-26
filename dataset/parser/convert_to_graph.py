import json

input_file = "primarySchool.dat"
output_file = "graph-data.js"

edges_set = set()
nodes_set = set()

with open(input_file, "r") as file:
    for line in file:
        parts = line.strip().split()
        if len(parts) < 2:
            continue
        source, target = parts[0], parts[1]

        # Undirected edge
        edge = tuple(sorted((source, target)))
        edges_set.add(edge)

        nodes_set.add(source)
        nodes_set.add(target)

# Build node and link data
nodes = [{"id": node, "label": node} for node in sorted(nodes_set)]
links = [{"source": src, "target": tgt} for src, tgt in sorted(edges_set)]

# Write to .js file in exact format
with open(output_file, "w") as js_file:
    js_file.write("export default {\n")
    js_file.write("    nodes: [\n")
    for i, node in enumerate(nodes):
        comma = "," if i < len(nodes) - 1 else ""
        js_file.write(f"        {{ id: '{node['id']}', label: '{node['label']}' }}{comma}\n")
    js_file.write("    ],\n")
    js_file.write("    links: [\n")
    for i, link in enumerate(links):
        comma = "," if i < len(links) - 1 else ""
        js_file.write(f"        {{ source: '{link['source']}', target: '{link['target']}' }}{comma}\n")
    js_file.write("    ]\n")
    js_file.write("};\n")
