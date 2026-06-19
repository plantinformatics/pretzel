#!/usr/bin/env python3

#-------------------------------------------------------------------------------
# Usage
#  pip install pandas xlsxwriter
#  python usage_chart.py Client_date.json AccessToken_Client.json usage_summary.xlsx
#
#-------------------------------------------------------------------------------
#
# The mongosh queries to produce the input json data files are :
# DBQuery.shellBatchSize=10000
#
# > AccessToken_Client.$logDate.json :
# db.AccessToken.aggregate({$project : {userId : 1, created : 1}},
#  {$lookup :  { from: "Client", localField: "userId", foreignField: "_id", as: "users" }},
#  {$project : {"users.password" : 0, "users.emailVerified" : 0, "users.verificationToken" : 0, "_id" : 0, "userId" : 0, "users._id" : 0}})
#
# > Client_date.$logDate.json :
# db.Client.aggregate([{$project : {_id : 0, email : 1, creationDate: { $toDate: "$_id" }    }  }])
#
#-------------------------------------------------------------------------------

import argparse
import json
import re
from pathlib import Path

import pandas as pd


ISO_DATE_RE = re.compile(r'ISODate\("([^"]+)"\)')
REPORT_TZ = "Australia/Sydney"


def read_mongo_json(path):
    """
    Reads either JSON-lines or a JSON array exported from Mongo-style JSON
    containing ISODate("...") values.
    """
    text = Path(path).read_text(encoding="utf-8")
    text = ISO_DATE_RE.sub(r'"\1"', text).strip()

    if not text.startswith("["):
        rows = []
        for line in text.splitlines():
            line = line.strip().rstrip(",")
            if line:
                rows.append(json.loads(line))
        return rows

    return json.loads(text)


def main():
    parser = argparse.ArgumentParser(
        description="Create Excel usage chart from account creation and login data."
    )
    parser.add_argument("client_dates_json")
    parser.add_argument("access_tokens_json")
    parser.add_argument("output_xlsx")
    parser.add_argument(
        "--freq",
        default="MS",
        help="Pandas period frequency: MS=month start, W=weekly, QS=quarterly",
    )
    args = parser.parse_args()

    # Read account creation dates
    clients = pd.DataFrame(read_mongo_json(args.client_dates_json))
    clients["creationDate"] = (
        pd.to_datetime(clients["creationDate"], utc=True, format="mixed")
          .dt.tz_convert(REPORT_TZ)
    )

    # Read login/access-token dates
    tokens = pd.DataFrame(read_mongo_json(args.access_tokens_json))
    tokens["created"] = (
        pd.to_datetime(tokens["created"], utc=True, format="mixed")
          .dt.tz_convert(REPORT_TZ)
    )


    # Date range covering both datasets
    start = min(clients["creationDate"].min(), tokens["created"].min())
    end = max(clients["creationDate"].max(), tokens["created"].max())

    # Avoid these warnings :
    #   UserWarning: Converting to Period representation will drop timezone information.
    #   Excel does not support datetimes with timezones
    start_month = start.tz_convert(REPORT_TZ).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end_month = end.tz_convert(REPORT_TZ).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # The previous version was :
    #   start=start.to_period("M").to_timestamp(),
    #   end=end.to_period("M").to_timestamp(),
    #   ... pd.date_range( ... tz="UTC", )

    periods = pd.date_range(
        start=start_month,
        end=end_month,
        freq=args.freq,
    )

    summary = pd.DataFrame({"Period": periods})
    summary["Period End"] = summary["Period"].shift(-1)
    summary.loc[summary.index[-1], "Period End"] = end + pd.Timedelta(seconds=1)

    summary["Logins"] = summary.apply(
        lambda r: ((tokens["created"] >= r["Period"]) &
                   (tokens["created"] < r["Period End"])).sum(),
        axis=1,
    )

    summary["Accounts Created In Period"] = summary.apply(
        lambda r: ((clients["creationDate"] >= r["Period"]) &
                   (clients["creationDate"] < r["Period End"])).sum(),
        axis=1,
    )

    summary["Total Accounts"] = summary["Accounts Created In Period"].cumsum()
    summary["Label"] = summary["Period"].dt.strftime("%Y-%m")

    summary["Period"] = summary["Period"].dt.tz_localize(None)
    summary["Period End"] = summary["Period End"].dt.tz_localize(None)

    # Write Excel file with chart
    with pd.ExcelWriter(
        args.output_xlsx,
        engine="xlsxwriter",
        datetime_format="yyyy-mm-dd hh:mm",
        date_format="yyyy-mm-dd",
    ) as writer:
        summary.to_excel(writer, sheet_name="Usage Summary", index=False)

        workbook = writer.book
        worksheet = writer.sheets["Usage Summary"]

        header_fmt = workbook.add_format({"bold": True, "bg_color": "#D9EAF7"})
        for col, name in enumerate(summary.columns):
            worksheet.write(0, col, name, header_fmt)

        worksheet.set_column("A:B", 20)
        worksheet.set_column("C:E", 18)
        worksheet.set_column("F:F", 12)

        nrows = len(summary)

        chart = workbook.add_chart({"type": "column"})

        chart.add_series({
            "name": "Logins",
            "categories": ["Usage Summary", 1, 5, nrows, 5],
            "values": ["Usage Summary", 1, 2, nrows, 2],
        })

        line_chart = workbook.add_chart({"type": "line"})
        line_chart.add_series({
            "name": "Total Accounts",
            "categories": ["Usage Summary", 1, 5, nrows, 5],
            "values": ["Usage Summary", 1, 4, nrows, 4],
            "y2_axis": True,
            "marker": {"type": "circle", "size": 5},
            "line": {"color": "black", "width": 2},
        })

        chart.combine(line_chart)

        chart.set_title({"name": "User account creation and logins"})
        chart.set_x_axis({"name": "Period"})
        chart.set_y_axis({"name": "Logins per period"})
        chart.set_y2_axis({"name": "Total accounts created"})
        chart.set_legend({"position": "bottom"})
        chart.set_size({"width": 900, "height": 500})

        worksheet.insert_chart("H2", chart)

    print(f"Wrote {args.output_xlsx}")


if __name__ == "__main__":
    main()
