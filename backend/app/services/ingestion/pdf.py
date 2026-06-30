"""
PDF Text Extraction Service.
Extracts plaintext from uploaded PDF byte files using the pypdf library.
"""

import io
import logging
from pypdf import PdfReader

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extracts plain text from raw PDF bytes.
    """
    try:
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        text_parts = []
        
        for page_num, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
            else:
                logger.warning(f"No text extracted from page {page_num + 1}")
                
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {str(e)}")
        raise ValueError(f"Error parsing PDF file: {str(e)}")
