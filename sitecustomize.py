import os
import sys

# TMS Desktop Agent Bootstrapper for TMS-Agent.exe
try:
    exe_name = os.path.basename(sys.executable).lower()
    # Check if launched directly as TMS-Agent.exe without python script arguments
    if "tms-agent" in exe_name and (len(sys.argv) <= 1 or (len(sys.argv) == 2 and sys.argv[1].lower().endswith(".exe"))):
        root_dir = os.path.dirname(os.path.abspath(__file__))
        agent_dir = os.path.join(root_dir, "agent")
        shared_dir = os.path.join(root_dir, "shared")

        if root_dir not in sys.path:
            sys.path.insert(0, root_dir)
        if agent_dir not in sys.path:
            sys.path.insert(0, agent_dir)
        if shared_dir not in sys.path:
            sys.path.insert(0, shared_dir)

        # Read associate ID from file if present
        assoc_id = os.getenv("TMS_ASSOCIATE_ID")
        assoc_file = os.path.join(root_dir, "associate_id.txt")
        if not assoc_id and os.path.exists(assoc_file):
            try:
                with open(assoc_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            assoc_id = line
                            break
            except Exception:
                pass

        if not assoc_id:
            assoc_id = "EMP101"

        os.environ["TMS_ASSOCIATE_ID"] = assoc_id

        # Pass arguments and invoke agent
        sys.argv = [os.path.join(agent_dir, "main.py"), "--associate", assoc_id]
        import agent.main
        agent.main.run_agent()
        os._exit(0)
except Exception as e:
    import traceback
    traceback.print_exc()
