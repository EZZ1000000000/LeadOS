# إضافة back-relations بالسطور مباشرة: Workspace / Lead / AgentRun
from pathlib import Path
import re

P = "prisma/schema.production.prisma"
lines = Path(P).read_text().splitlines()

def find_model(name):
    for i, l in enumerate(lines):
        if re.match(rf"^ model {name} \{{$", l):
            # closing " }" على نفس المستوى
            for j in range(i + 1, len(lines)):
                if lines[j].rstrip() == "}":
                    return i, j
    return None

WS_REL = [
    "  sequences          Sequence[]",
    "  enrollments        SequenceEnrollment[]",
    "  experiments        AbExperiment[]",
    "  evolutionProposals EvolutionProposal[]",
    "  platformAccounts   PlatformAccount[]",
    "  tacticStats        TacticStat[]",
]

def insert_before_close(model, new_lines, skip_existing_re):
    r = find_model(model)
    assert r, f"model {model} مش موجود"
    i, j = r
    body = "\n".join(lines[i:j])
    add = [l for l in new_lines if not re.search(skip_existing_re, body, re.M)]
    if not add:
        print(f"  {model}: موجود كله")
        return
    lines[j:j] = add
    print(f"  {model}: زودت {len(add)} سطر")

insert_before_close("Workspace", WS_REL, r"^\s*(sequences|enrollments|experiments|evolutionProposals|platformAccounts|tacticStats)\s")
insert_before_close("Lead", ["  enrollments      SequenceEnrollment[]"], r"^\s*enrollments\s")
insert_before_close("AgentRun", ["  mode      String?", "  progress  String?", "  strategy  String?"], r"^\s*(mode|progress|strategy)\s")

Path(P).write_text("\n".join(lines) + "\n")
print("اتكتب")
