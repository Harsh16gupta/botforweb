import io
import re
import zipfile
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

FRONTMATTER_PATTERN = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_markdown_content(content: str, filename: str) -> Dict[str, Any]:
    """
    Parses markdown content, extracts YAML frontmatter if present,
    and returns a dict containing raw text and extracted metadata.
    """
    metadata = {"source": filename}
    clean_text = content

    match = FRONTMATTER_PATTERN.match(content)
    if match:
        frontmatter_text = match.group(1)
        # Remove frontmatter from the main body text
        clean_text = content[match.end():]
        
        # Simple key-value parser for YAML-like frontmatter
        for line in frontmatter_text.splitlines():
            if ":" in line:
                parts = line.split(":", 1)
                k = parts[0].strip()
                v = parts[1].strip().strip('"').strip("'")
                # Avoid overriding reserved keys
                if k not in ["source"]:
                    metadata[k] = v

    return {
        "text": clean_text.strip(),
        "metadata": metadata
    }


def extract_markdown_from_zip(zip_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Unpacks a ZIP archive, reads all Markdown files, parses their content,
    and returns a list of dictionaries with text and metadata.
    """
    parsed_docs = []
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
            for file_info in z.infolist():
                # Ignore directories and non-markdown files
                if file_info.is_dir() or not file_info.filename.lower().endswith((".md", ".markdown")):
                    continue
                
                try:
                    with z.open(file_info) as f:
                        content = f.read().decode("utf-8", errors="ignore")
                        parsed = parse_markdown_content(content, file_info.filename)
                        parsed_docs.append(parsed)
                except Exception as file_error:
                    logger.error(f"Error reading file {file_info.filename} from ZIP: {str(file_error)}")
                    continue
                    
        return parsed_docs
    except Exception as e:
        logger.error(f"Failed to extract files from ZIP archive: {str(e)}")
        raise ValueError(f"Error processing ZIP file: {str(e)}")
