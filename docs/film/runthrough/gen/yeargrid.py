#!/usr/bin/env python3
"""The synthetic unavailability year grid the AM5 take imports: sheet '2026', a row per demo person, a column per day (ISO date headers), marks in Oct–Nov."""
import openpyxl,datetime,sys
wb=openpyxl.Workbook(); ws=wb.active; ws.title="2026"
names=["Jordan Lee","Wei Ng","Sam Patel","Amara Okafor","Alex Chen","Morgan O'Brien","Kim Nguyen","Riley Silva","Harper Singh","Dana Kowalski","Tom Abebe","Lena Fischer"]
ws.append(["Wattle Hospital · Emergency Medicine · unavailability 2026"]); ws.append([])
d0=datetime.date(2026,1,1); days=[d0+datetime.timedelta(days=i) for i in range(365)]
ws.append(["Name","EFT","Hours"]+[d.isoformat() for d in days])
marks={"Jordan Lee":{"2026-10-12":"x","2026-10-13":"x","2026-11-06":"PM"},"Wei Ng":{"2026-10-20":"AM","2026-11-23":"x","2026-11-24":"x","2026-11-25":"x"},
 "Sam Patel":{"2026-10-26":"AL","2026-10-27":"AL","2026-10-28":"AL"},"Amara Okafor":{"2026-11-02":"x","2026-11-16":"1"},
 "Alex Chen":{"2026-10-09":"x","2026-11-27":"PM"},"Kim Nguyen":{"2026-10-30":"x","2026-11-13":"x"},"Harper Singh":{"2026-11-09":"AM"},"Lena Fischer":{"2026-10-16":"x","2026-11-20":"x"}}
for n in names: ws.append([n,1,80]+[marks.get(n,{}).get(d.isoformat()) for d in days])
wb.save(sys.argv[1] if len(sys.argv)>1 else "year-grid-2026.xlsx")
