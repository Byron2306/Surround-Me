import json
import pathlib
import tempfile
import unittest

from tools.verify_phase_a_acceptance import MANDATORY_IDS, verify_acceptance


class PhaseAAcceptanceTests(unittest.TestCase):
    def write(self, checks):
        td = tempfile.TemporaryDirectory()
        path = pathlib.Path(td.name) / "acceptance.json"
        path.write_text(json.dumps({"checks": checks}), encoding="utf-8")
        return td, path

    def test_needs_review_refuses_acceptance(self):
        checks = [{"id": item, "state": "PASS"} for item in sorted(MANDATORY_IDS)]
        checks[0]["state"] = "NEEDS_REVIEW"
        td, path = self.write(checks)
        try:
            errors = verify_acceptance(path)
            self.assertTrue(any("NEEDS_REVIEW" in e for e in errors), errors)
        finally:
            td.cleanup()

    def test_refuse_refuses_acceptance(self):
        checks = [{"id": item, "state": "PASS"} for item in sorted(MANDATORY_IDS)]
        checks[-1]["state"] = "REFUSE"
        td, path = self.write(checks)
        try:
            errors = verify_acceptance(path)
            self.assertTrue(any("REFUSE" in e for e in errors), errors)
        finally:
            td.cleanup()

    def test_missing_mandatory_check_refuses_acceptance(self):
        ids = sorted(MANDATORY_IDS)
        checks = [{"id": item, "state": "PASS"} for item in ids[1:]]
        td, path = self.write(checks)
        try:
            errors = verify_acceptance(path)
            self.assertTrue(any("missing mandatory" in e for e in errors), errors)
        finally:
            td.cleanup()

    def test_all_pass_accepts(self):
        checks = [{"id": item, "state": "PASS"} for item in sorted(MANDATORY_IDS)]
        td, path = self.write(checks)
        try:
            self.assertEqual(verify_acceptance(path), [])
        finally:
            td.cleanup()


if __name__ == "__main__":
    unittest.main()
