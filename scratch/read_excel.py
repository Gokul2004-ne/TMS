import zipfile
import xml.etree.ElementTree as ET

z = zipfile.ZipFile(r'b:\Projects\TMS\Project_Requirements\Prev Entd Voice T&M.xlsx')

# Extract shared strings properly
sst_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
ns_sst = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
shared_strings = []
for si in sst_root.findall('ns:si', ns_sst):
    text_pieces = []
    for t in si.findall('.//ns:t', ns_sst):
        if t.text:
            text_pieces.append(t.text)
    shared_strings.append(''.join(text_pieces))

print(f"Total Shared Strings: {len(shared_strings)}")

# Look at sheet names
wb_root = ET.fromstring(z.read('xl/workbook.xml'))
sheets = wb_root.findall('.//ns:sheet', ns_sst)
sheet_map = {s.attrib.get('name'): s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id') for s in sheets}
print("Sheets in workbook:", sheet_map)

# Let's inspect sheet1 or sheet2
for sname in ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']:
    if sname in z.namelist():
        print(f"\n=================== {sname} ===================")
        sheet_tree = ET.fromstring(z.read(sname))
        rows = sheet_tree.findall('.//ns:row', ns_sst)
        for r in rows[:18]:
            r_idx = r.attrib.get('r')
            cell_data = {}
            for c in r.findall('ns:c', ns_sst):
                ref = c.attrib.get('r')
                col_letter = ''.join([ch for ch in ref if ch.isalpha()])
                t_attr = c.attrib.get('t')
                v_el = c.find('ns:v', ns_sst)
                val = v_el.text if v_el is not None else ''
                if t_attr == 's' and val.isdigit():
                    val = shared_strings[int(val)]
                cell_data[col_letter] = val
            if any(cell_data.values()):
                print(f"Row {r_idx}: {cell_data}")
