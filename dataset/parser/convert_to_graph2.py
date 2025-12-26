import json

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
    group_file = "student.dat"  # updated filename
    output_file = "graph-data.js"


    edges_set = set()
    nodes_set = set()

    with open(edge_file, "r") as file:
        for line in file:
            parts = line.strip().split()
            if len(parts) < 2:
                continue
            source, target = parts[0], parts[1]

            edge = tuple(sorted((source, target)))  # undirected
            edges_set.add(edge)

            nodes_set.add(source)
            nodes_set.add(target)

    group_map, teacher_ids = parse_group_file(group_file)

    # Construct node list
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

    # Construct link list
    links = [{"source": src, "target": tgt} for src, tgt in sorted(edges_set)]

    # Write final JS file
    with open(output_file, "w") as js_file:
        js_file.write("export default {\n")
        js_file.write("    nodes: [\n")
        for i, node in enumerate(nodes):
            parts = [f"id: '{node['id']}'", f"label: '{node['label']}'"]
            if "group" in node:
                parts.append(f"group: '{node['group']}'")
            if "isTeacher" in node:
                parts.append("isTeacher: true")
            line = "        { " + ", ".join(parts) + " }"
            if i < len(nodes) - 1:
                line += ","
            js_file.write(line + "\n")
        js_file.write("    ],\n")

        js_file.write("    links: [\n")
        for i, link in enumerate(links):
            line = f"        {{ source: '{link['source']}', target: '{link['target']}' }}"
            if i < len(links) - 1:
                line += ","
            js_file.write(line + "\n")
        js_file.write("    ]\n")
        js_file.write("};\n")

if __name__ == "__main__":
    main()
