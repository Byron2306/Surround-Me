from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from PIL import Image

from tools.build_hd_iso_intersection import build_intersection


class IntersectionBuilderTests(unittest.TestCase):
    def test_builds_contract_master_and_runtime_with_clean_alpha_edges(self):
        source = Path("asphalt1.png")
        if not source.exists():
            self.skipTest("Surround Me asphalt source not present")

        with TemporaryDirectory() as td:
            td = Path(td)
            master = td / "master.png"
            runtime = td / "runtime.webp"
            build_intersection(source, master, runtime)

            with Image.open(master).convert("RGBA") as image:
                self.assertEqual(image.size, (2048, 2048))
                self.assertEqual(
                    [image.getpixel(p)[3] for p in [(0, 0), (2047, 0), (0, 2047), (2047, 2047)]],
                    [0, 0, 0, 0],
                )
                bbox = image.getchannel("A").getbbox()
                self.assertIsNotNone(bbox)
                self.assertEqual(bbox[0], 0)
                self.assertEqual(bbox[2], 2048)
                self.assertEqual(bbox[3], 2048, "road bottom point must terminate on bottom-centre anchor")
                self.assertGreaterEqual(bbox[1], 1000)
                self.assertLessEqual(bbox[1], 1030)

            with Image.open(runtime).convert("RGBA") as image:
                self.assertEqual(image.size, (1024, 1024))
                bbox = image.getchannel("A").getbbox()
                self.assertEqual(bbox[0], 0)
                self.assertEqual(bbox[2], 1024)
                self.assertEqual(bbox[3], 1024)


if __name__ == "__main__":
    unittest.main()
