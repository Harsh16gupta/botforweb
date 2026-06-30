from typing import List


class RecursiveCharacterTextSplitter:
    """
    A simple, robust, and pure-Python text splitter that chunks text recursively 
    by trying different separators (double newlines, single newlines, spaces, etc.) 
    to preserve semantic structure (paragraphs, sentences) where possible.
    """

    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        separators: List[str] = None,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", " ", ""]

    def split_text(self, text: str) -> List[str]:
        """Splits the input text into chunks of maximum size with overlap."""
        return self._split_text(text, self.separators)

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        # If the text is already smaller than chunk_size, return it as a single chunk
        if len(text) <= self.chunk_size:
            return [text]

        # If we ran out of separators, force-split it by chunk size
        if not separators:
            return [text[i:i + self.chunk_size] for i in range(0, len(text), self.chunk_size - self.chunk_overlap)]

        separator = separators[0]
        splits = text.split(separator)
        
        # If the separator doesn't exist in the text, try the next separator
        if len(splits) == 1:
            return self._split_text(text, separators[1:])

        # Now merge splits into chunks of target size
        chunks = []
        current_chunk = []
        current_length = 0

        for split in splits:
            split_len = len(split)
            
            # If a single split exceeds chunk_size, we need to recursively split it using remaining separators
            if split_len > self.chunk_size:
                # Merge whatever we have in current_chunk first
                if current_chunk:
                    chunks.append(separator.join(current_chunk))
                    current_chunk = []
                    current_length = 0
                
                # Recursively split the long block
                sub_splits = self._split_text(split, separators[1:])
                chunks.extend(sub_splits)
                continue

            # If adding this split exceeds chunk_size, save current_chunk and start a new one with overlap
            # Note: We include separator length in our length calculations
            sep_len = len(separator) if current_chunk else 0
            if current_length + sep_len + split_len > self.chunk_size:
                chunks.append(separator.join(current_chunk))
                
                # Handle overlap: take trailing items from current_chunk that fit in overlap
                overlap_chunk = []
                overlap_len = 0
                for item in reversed(current_chunk):
                    item_sep_len = len(separator) if overlap_chunk else 0
                    if overlap_len + item_sep_len + len(item) <= self.chunk_overlap:
                        overlap_chunk.insert(0, item)
                        overlap_len += item_sep_len + len(item)
                    else:
                        break
                
                current_chunk = overlap_chunk
                current_length = overlap_len

            # Add split to current chunk
            current_sep_len = len(separator) if current_chunk else 0
            current_chunk.append(split)
            current_length += current_sep_len + split_len

        # Append last remaining chunk
        if current_chunk:
            chunks.append(separator.join(current_chunk))

        # Filter out empty chunks and strip whitespaces
        return [chunk.strip() for chunk in chunks if chunk.strip()]
