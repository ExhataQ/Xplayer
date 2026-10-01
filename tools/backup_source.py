from pathlib import Path
import json
import shutil


# This script lives inside Source/tools/
TOOLS = Path(__file__).resolve().parent
SOURCE = TOOLS.parent

BACKUP = SOURCE.parent / "Source-backup"
ZIP_FILE = SOURCE.parent / "Source-backup.zip"


def read_package_json():
    package_file = SOURCE / "package.json"

    if not package_file.exists():
        raise FileNotFoundError(f"Missing: {package_file}")

    with package_file.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_installed_version(package_name):
    package_json = SOURCE / "node_modules" / package_name / "package.json"

    if not package_json.exists():
        return "NOT INSTALLED"

    try:
        with package_json.open("r", encoding="utf-8") as f:
            data = json.load(f)

        return data.get("version", "UNKNOWN")
    except Exception as e:
        return f"ERROR: {e}"


def create_package_manifest(package_data):
    lines = [
        "Lightweight backup of the Source project.",
        "",
        "The real node_modules directory was intentionally excluded.",
        "The .git directory was also excluded.",
        "",
        "This file represents the top-level npm packages installed in Source.",
        "",
    ]

    for section in (
        "dependencies",
        "devDependencies",
        "optionalDependencies",
    ):
        packages = package_data.get(section, {})

        if not packages:
            continue

        lines.append(section + ":")
        lines.append("-" * len(section))

        for package_name in sorted(packages):
            version = get_installed_version(package_name)
            lines.append(f"{package_name} {version}")

        lines.append("")

    manifest = BACKUP / "node_modules" / "INSTALLED_PACKAGES.txt"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text("\n".join(lines), encoding="utf-8")


def ignore_directory(directory, names):
    ignored = set(names) & {"node_modules", ".git"}
    return ignored


def remove_readonly(func, path, exc_info):
    """
    Windows cleanup handler for read-only files.
    """
    import os
    import stat

    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        raise

def main():
    print("Source backup tool")
    print("==================")
    print()
    print(f"Source: {SOURCE}")
    print()

    if not SOURCE.exists():
        raise FileNotFoundError(
            f"Source folder does not exist:\n{SOURCE}"
        )

    package_data = read_package_json()

    # Remove any leftover temporary backup directory from a previous run.
    if BACKUP.exists():
        print("Removing previous temporary backup folder...")
        shutil.rmtree(
            BACKUP,
            onexc=remove_readonly
        )

    print("Copying Source...")
    print("Excluding node_modules and .git...")

    shutil.copytree(
        SOURCE,
        BACKUP,
        ignore=ignore_directory
    )

    print("Recording installed packages...")

    backup_node_modules = BACKUP / "node_modules"
    backup_node_modules.mkdir(parents=True, exist_ok=True)

    create_package_manifest(package_data)

    # Create the new ZIP under a temporary filename first.
    TEMP_ZIP_FILE = SOURCE.parent / "Source-backup-new.zip"

    if TEMP_ZIP_FILE.exists():
        TEMP_ZIP_FILE.unlink()

    print("Creating ZIP...")

    try:
        shutil.make_archive(
            str(TEMP_ZIP_FILE.with_suffix("")),
            "zip",
            root_dir=BACKUP.parent,
            base_dir=BACKUP.name
        )
    except Exception:
        if TEMP_ZIP_FILE.exists():
            TEMP_ZIP_FILE.unlink()
        raise

    if not TEMP_ZIP_FILE.exists():
        raise RuntimeError("ZIP creation failed.")

    print("ZIP created successfully.")

    # The new backup is complete, so it is now safe to replace the old one.
    if ZIP_FILE.exists():
        print("Replacing previous backup ZIP...")
        ZIP_FILE.unlink()

    TEMP_ZIP_FILE.replace(ZIP_FILE)

    print("Removing temporary uncompressed backup...")

    try:
        shutil.rmtree(
            BACKUP,
            onexc=remove_readonly
        )
    except Exception as e:
        print()
        print("WARNING: ZIP was created successfully,")
        print("but the temporary backup could not be removed.")
        print(f"Reason: {e}")
        print()
        print(f"Temporary folder: {BACKUP}")
        print(f"ZIP:              {ZIP_FILE}")
        return

    print()
    print("Done.")
    print()
    print(f"Backup: {ZIP_FILE}")
    print()
    print("Excluded:")
    print("  node_modules")
    print("  .git")
    print()
    print("Recorded:")
    print("  node_modules\\INSTALLED_PACKAGES.txt")

if __name__ == "__main__":
    main()