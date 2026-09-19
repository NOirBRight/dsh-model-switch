# Unset Default Subagent route means Official inherit

`follow-main` duplicated DSH's live-parent inherit after 0.1.6. The Subagent card will offer only an optional fixed Default Subagent route; turning it off leaves Official inherit in place. Stored `follow-main` is read as unset and is not rewritten. Turning the fixed default off keeps the last provider/model on disk. Model Switch will not keep a second inherit policy beside the official one.
