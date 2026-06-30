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
        # target character length of each chunk
        self.chunk_size = chunk_size
        # characters shared between adjacent chunks (prevents losing context at boundaries)
        self.chunk_overlap = chunk_overlap
        # separators list ordered from most semantic (paragraphs) to least semantic (characters)
        self.separators = separators or ["\n\n", "\n", " ", ""]

    def split_text(self, text: str) -> List[str]:
        """Splits the input text into chunks of maximum size with overlap."""
        return self._split_text(text, self.separators)

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        # Rule 1: If text is already small enough, no splitting needed. Return it immediately.
        if len(text) <= self.chunk_size:
            return [text]

        # Rule 2: If we run out of separators, force-split the text purely by character index
        if not separators:
            return [text[i:i + self.chunk_size] for i in range(0, len(text), self.chunk_size - self.chunk_overlap)]

        # Rule 3: Try splitting the text using the first separator in the list (e.g., "\n\n")
        separator = separators[0]
        splits = text.split(separator)
        
        # Rule 4: If the separator does not exist in the text, try again with the remaining separators
        if len(splits) == 1:
            return self._split_text(text, separators[1:])

        # Now merge the splits back together into chunks up to our target size
        chunks = []
        current_chunk = []
        current_length = 0

        for split in splits:
            split_len = len(split)
            
            # If a single split block is larger than chunk_size (e.g. a huge paragraph),
            # recursively split that block using the rest of the separators (e.g., "\n", " ")
            if split_len > self.chunk_size:
                # Save whatever we have collected so far before splitting the large block
                if current_chunk:
                    chunks.append(separator.join(current_chunk))
                    current_chunk = []
                    current_length = 0
                
                # Split the large block recursively and add the sub-chunks to our list
                sub_splits = self._split_text(split, separators[1:])
                chunks.extend(sub_splits)
                continue

            # If adding this split exceeds the target chunk size, save the current chunk
            # and start a new one containing overlap characters
            sep_len = len(separator) if current_chunk else 0
            if current_length + sep_len + split_len > self.chunk_size:
                chunks.append(separator.join(current_chunk))
                
                # Backtrack: pull in trailing splits that fit inside the overlap size
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

            # Append the current split block to the working chunk
            current_sep_len = len(separator) if current_chunk else 0
            current_chunk.append(split)
            current_length += current_sep_len + split_len

        # Append the final working chunk if it has text
        if current_chunk:
            chunks.append(separator.join(current_chunk))

        # Clean up: remove whitespace-only chunks and return the final list of chunks
        return [chunk.strip() for chunk in chunks if chunk.strip()]

