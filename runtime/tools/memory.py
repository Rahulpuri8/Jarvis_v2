"""
Long-Term Memory & Local Knowledge Base (RAG) Tool Suite for JARVIS
Powered by SQLite FTS5 for fast, private, offline retrieval.
"""

import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..core.models import ToolDefinition, ToolRiskLevel


class MemoryManager:
    _instance: Optional["MemoryManager"] = None

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = data_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
        os.makedirs(self.data_dir, exist_ok=True)
        self.db_path = os.path.join(self.data_dir, "memory.db")
        self._init_db()

    @classmethod
    def get_instance(cls) -> "MemoryManager":
        if cls._instance is None:
            cls._instance = MemoryManager()
        return cls._instance

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Initialize database schema with FTS5 virtual tables"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # 1. Fact / Preference store
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    category TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    tags TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # 2. Knowledge documents store
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_docs (
                    id TEXT PRIMARY KEY,
                    file_path TEXT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    chunk_index INTEGER DEFAULT 0,
                    metadata TEXT,
                    created_at TEXT NOT NULL
                )
            """)

            # 3. FTS5 full-text index
            cursor.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
                    id UNINDEXED,
                    title,
                    content,
                    file_path UNINDEXED
                )
            """)
            conn.commit()

            # Seed default system memories if empty
            cursor.execute("SELECT COUNT(*) FROM memories")
            if cursor.fetchone()[0] == 0:
                self._seed_default_memories(cursor)
                conn.commit()

    def _seed_default_memories(self, cursor: sqlite3.Cursor) -> None:
        now = datetime.now().isoformat()
        defaults = [
            ("mem_001", "preference", "theme", "Dark Glassmorphism UI", "ui,preferences", now, now),
            ("mem_002", "preference", "preferred_model", "Qwen2.5-3B Local LLM", "ai,models", now, now),
            ("mem_003", "contact", "Sarah Connor", "sarah.lead@innovate.tech (Engineering Lead)", "contacts,team", now, now),
            ("mem_004", "contact", "Alex Mercer", "alex.dev@innovate.tech (Frontend/Automation Dev)", "contacts,team", now, now),
            ("mem_005", "instruction", "security_rule", "Always request confirmation before sending emails or running destructive commands", "security,rules", now, now),
        ]
        cursor.executemany(
            "INSERT INTO memories (id, category, key, value, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            defaults,
        )

    def store_fact(
        self,
        key: str,
        value: str,
        category: str = "fact",
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Store or update a user fact, preference, contact, or guideline"""
        now = datetime.now().isoformat()
        tag_str = ",".join(tags) if tags else ""

        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Check if key already exists in same category
            cursor.execute("SELECT id FROM memories WHERE LOWER(key) = LOWER(?) AND category = ?", (key.strip(), category.strip()))
            existing = cursor.fetchone()

            if existing:
                memory_id = existing["id"]
                cursor.execute(
                    "UPDATE memories SET value = ?, tags = ?, updated_at = ? WHERE id = ?",
                    (value.strip(), tag_str, now, memory_id),
                )
                action = "updated"
            else:
                memory_id = f"mem_{uuid.uuid4().hex[:8]}"
                cursor.execute(
                    "INSERT INTO memories (id, category, key, value, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (memory_id, category.strip(), key.strip(), value.strip(), tag_str, now, now),
                )
                action = "stored"

            conn.commit()

        return {
            "id": memory_id,
            "category": category,
            "key": key,
            "value": value,
            "action": action,
            "message": f"Successfully {action} memory: '{key}' -> '{value}'",
        }

    def recall(self, query: str, limit: int = 5, category: Optional[str] = None) -> Dict[str, Any]:
        """Recall facts and memories matching a query string or category"""
        q = query.strip().lower()
        sql = "SELECT id, category, key, value, tags, updated_at FROM memories WHERE 1=1"
        params: List[Any] = []

        if category:
            sql += " AND category = ?"
            params.append(category)

        sql += " AND (LOWER(key) LIKE ? OR LOWER(value) LIKE ? OR LOWER(tags) LIKE ?)"
        pattern = f"%{q}%"
        params.extend([pattern, pattern, pattern])
        sql += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            results = [
                {
                    "id": r["id"],
                    "category": r["category"],
                    "key": r["key"],
                    "value": r["value"],
                    "tags": r["tags"].split(",") if r["tags"] else [],
                    "updated_at": r["updated_at"],
                }
                for r in rows
            ]

        # If strict query returned no results, fallback to all memories in category
        if not results and category:
            return self.list_memories(category=category, limit=limit)

        return {
            "query": query,
            "count": len(results),
            "memories": results,
            "summary": "\n".join([f"• [{m['category']}] {m['key']}: {m['value']}" for m in results]) if results else "No matching memories found.",
        }

    def list_memories(self, category: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        """List all stored memories and preferences"""
        sql = "SELECT id, category, key, value, tags, updated_at FROM memories"
        params: List[Any] = []
        if category:
            sql += " WHERE category = ?"
            params.append(category)
        sql += " ORDER BY category ASC, updated_at DESC LIMIT ?"
        params.append(limit)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            results = [
                {
                    "id": r["id"],
                    "category": r["category"],
                    "key": r["key"],
                    "value": r["value"],
                    "tags": r["tags"].split(",") if r["tags"] else [],
                    "updated_at": r["updated_at"],
                }
                for r in rows
            ]

        return {
            "count": len(results),
            "category_filter": category or "all",
            "memories": results,
        }

    def delete_fact(self, key_or_id: str) -> Dict[str, Any]:
        """Delete a memory entry by ID or key"""
        target = key_or_id.strip()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM memories WHERE id = ? OR LOWER(key) = LOWER(?)", (target, target))
            deleted_count = cursor.rowcount
            conn.commit()

        if deleted_count > 0:
            return {"deleted": True, "target": target, "message": f"Deleted memory '{target}'."}
        return {"deleted": False, "target": target, "message": f"Memory '{target}' not found."}

    def index_document(
        self,
        file_path: Optional[str] = None,
        title: Optional[str] = None,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Index a file or note chunk into the local SQLite FTS5 knowledge base"""
        doc_title = title or (os.path.basename(file_path) if file_path else "Untitled Note")
        doc_content = content or ""

        if file_path and os.path.exists(file_path) and not doc_content:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    doc_content = f.read()
            except Exception as e:
                return {"error": f"Failed to read file '{file_path}': {str(e)}"}

        if not doc_content.strip():
            return {"error": "No content provided to index."}

        # Chunk document if large (> 2000 chars)
        chunk_size = 2000
        chunks = [doc_content[i:i + chunk_size] for i in range(0, len(doc_content), chunk_size)]
        now = datetime.now().isoformat()
        meta_str = json.dumps(metadata or {})

        indexed_ids = []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for idx, chunk in enumerate(chunks):
                doc_id = f"doc_{uuid.uuid4().hex[:8]}"
                cursor.execute(
                    "INSERT INTO knowledge_docs (id, file_path, title, content, chunk_index, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (doc_id, file_path or "", doc_title, chunk, idx, meta_str, now),
                )
                cursor.execute(
                    "INSERT INTO knowledge_fts (id, title, content, file_path) VALUES (?, ?, ?, ?)",
                    (doc_id, doc_title, chunk, file_path or ""),
                )
                indexed_ids.append(doc_id)
            conn.commit()

        return {
            "title": doc_title,
            "file_path": file_path,
            "chunks_indexed": len(chunks),
            "doc_ids": indexed_ids,
            "status": "indexed",
            "message": f"Indexed '{doc_title}' ({len(chunks)} chunk(s)) into knowledge base.",
        }

    def index_directory(self, folder_path: str, max_files: int = 50) -> Dict[str, Any]:
        """Recursively index a project directory into the local knowledge base"""
        if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
            return {"success": False, "error": f"Directory '{folder_path}' does not exist."}

        ignored_dirs = {"node_modules", ".git", ".venv", "dist", "build", ".next", "__pycache__"}
        allowed_exts = {".ts", ".tsx", ".js", ".jsx", ".py", ".md", ".json", ".yml", ".yaml", ".html", ".css", ".sql", ".txt"}

        indexed_files = []
        file_count = 0

        for root, dirs, files in os.walk(folder_path):
            dirs[:] = [d for d in dirs if d not in ignored_dirs and not d.startswith(".")]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in allowed_exts:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, folder_path)
                    res = self.index_document(file_path=full_path, title=rel_path)
                    if "chunks_indexed" in res:
                        indexed_files.append(rel_path)
                        file_count += 1
                        if file_count >= max_files:
                            break
            if file_count >= max_files:
                break

        return {
            "success": True,
            "folder_path": folder_path,
            "indexed_count": file_count,
            "files": indexed_files,
            "message": f"Successfully indexed {file_count} files from project directory.",
        }

    def search_knowledge(self, query: str, limit: int = 5) -> Dict[str, Any]:
        """Full-text BM25 search over indexed knowledge documents and notes"""
        q = query.strip()
        if not q:
            return {"query": query, "count": 0, "results": []}

        # Clean query for FTS5 syntax
        clean_q = "".join([c if c.isalnum() or c.isspace() else " " for c in q]).strip()
        terms = [t for t in clean_q.split() if len(t) > 1]
        if not terms:
            terms = [clean_q]

        fts_match = " OR ".join([f'"{t}"*' for t in terms])

        with self._get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    SELECT 
                        k.id,
                        k.title,
                        k.file_path,
                        k.content,
                        snippet(knowledge_fts, 2, '<b>', '</b>', '...', 25) as snippet,
                        bm25(knowledge_fts) as rank
                    FROM knowledge_fts f
                    JOIN knowledge_docs k ON f.id = k.id
                    WHERE knowledge_fts MATCH ?
                    ORDER BY rank ASC
                    LIMIT ?
                """, (fts_match, limit))
                rows = cursor.fetchall()
            except Exception:
                # Fallback to simple LIKE search if FTS syntax error
                cursor.execute("""
                    SELECT id, title, file_path, content, SUBSTR(content, 1, 200) as snippet, 1.0 as rank
                    FROM knowledge_docs
                    WHERE content LIKE ? OR title LIKE ?
                    LIMIT ?
                """, (f"%{q}%", f"%{q}%", limit))
                rows = cursor.fetchall()

            results = [
                {
                    "id": r["id"],
                    "title": r["title"],
                    "file_path": r["file_path"],
                    "snippet": r["snippet"],
                    "relevance_score": round(abs(float(r["rank"])), 2) if r["rank"] is not None else 1.0,
                }
                for r in rows
            ]

        return {
            "query": query,
            "count": len(results),
            "results": results,
            "summary": "\n".join([f"• [{r['title']}] {r['snippet']}" for r in results]) if results else "No knowledge base documents found matching your query.",
        }


# ==========================================
# Tool Wrappers for JARVIS Tool Gateway
# ==========================================

memory_manager = MemoryManager.get_instance()


def memory_store_fact(key: str = "", value: str = "", category: str = "fact", tags: Optional[List[str]] = None, **kwargs) -> Dict[str, Any]:
    k = key or kwargs.get("name", "fact")
    v = value or kwargs.get("content", "")
    return memory_manager.store_fact(key=k, value=v, category=category, tags=tags)


def memory_recall(query: str = "", limit: int = 5, category: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    q = query or kwargs.get("topic", "") or kwargs.get("key", "")
    return memory_manager.recall(query=q, limit=limit, category=category)


def memory_list_memories(category: Optional[str] = None, limit: int = 50, **kwargs) -> Dict[str, Any]:
    return memory_manager.list_memories(category=category, limit=limit)


def memory_delete_fact(key_or_id: str = "", key: str = "", id: str = "", **kwargs) -> Dict[str, Any]:
    target = key_or_id or key or id or kwargs.get("name", "")
    return memory_manager.delete_fact(key_or_id=target)


def memory_index_document(
    file_path: Optional[str] = None,
    path: Optional[str] = None,
    title: Optional[str] = None,
    content: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    target_path = file_path or path
    return memory_manager.index_document(
        file_path=target_path,
        title=title,
        content=content,
        metadata=kwargs.get("metadata"),
    )


def memory_search_knowledge(query: str = "", limit: int = 5, **kwargs) -> Dict[str, Any]:
    q = query or kwargs.get("topic", "") or kwargs.get("search", "")
    return memory_manager.search_knowledge(query=q, limit=limit)


def memory_index_directory(folder_path: str, max_files: int = 50, **kwargs) -> Dict[str, Any]:
    fpath = folder_path or kwargs.get("directory", "") or kwargs.get("path", "")
    return memory_manager.index_directory(folder_path=fpath, max_files=max_files)


def register_memory_tools(registry) -> None:
    registry.register(
        ToolDefinition(
            name="memory.store_fact",
            description="Save a persistent fact, user preference, contact, or guideline to long-term memory.",
            category="memory",
            arguments_schema={
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Subject/key for the memory (e.g. 'favorite_editor', 'manager')"},
                    "value": {"type": "string", "description": "The fact or preference details to remember"},
                    "category": {"type": "string", "description": "Category e.g. 'preference', 'fact', 'contact', 'instruction'", "default": "fact"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "Optional search tags"},
                },
                "required": ["key", "value"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["memory:write"],
        ),
        memory_store_fact,
    )

    registry.register(
        ToolDefinition(
            name="memory.recall",
            description="Retrieve stored user facts, preferences, contacts, or guidelines matching a query.",
            category="memory",
            arguments_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Keyword or topic to search across remembered facts"},
                    "limit": {"type": "integer", "description": "Maximum facts to return (default: 5)"},
                    "category": {"type": "string", "description": "Optional category filter"},
                },
                "required": ["query"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["memory:read"],
        ),
        memory_recall,
    )

    registry.register(
        ToolDefinition(
            name="memory.list_memories",
            description="List all stored user facts, preferences, and guidelines in long-term memory.",
            category="memory",
            arguments_schema={
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Optional category filter"},
                    "limit": {"type": "integer", "description": "Maximum entries to return (default: 50)"},
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["memory:read"],
        ),
        memory_list_memories,
    )

    registry.register(
        ToolDefinition(
            name="memory.delete_fact",
            description="Delete a fact or preference from long-term memory by key or ID.",
            category="memory",
            arguments_schema={
                "type": "object",
                "properties": {
                    "key_or_id": {"type": "string", "description": "Key or ID of the memory to remove"},
                },
                "required": ["key_or_id"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["memory:write"],
        ),
        memory_delete_fact,
    )

    registry.register(
        ToolDefinition(
            name="memory.index_document",
            description="Index a file, markdown note, or document chunk into the local knowledge base.",
            category="memory",
            arguments_schema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Local file path to index"},
                    "title": {"type": "string", "description": "Title of the note or document"},
                    "content": {"type": "string", "description": "Text content to index directly"},
                },
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["memory:write"],
        ),
        memory_index_document,
    )

    registry.register(
        ToolDefinition(
            name="memory.search_knowledge",
            description="Search local knowledge base documents and notes using full-text BM25 ranking.",
            category="memory",
            arguments_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query for knowledge documents"},
                    "limit": {"type": "integer", "description": "Maximum matching snippets to return"},
                },
                "required": ["query"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["memory:read"],
        ),
        memory_search_knowledge,
    )

    registry.register(
        ToolDefinition(
            name="memory.index_directory",
            description="Recursively index all code and document files in a project directory into local knowledge base.",
            category="memory",
            arguments_schema={
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "description": "Project directory path to index"},
                    "max_files": {"type": "integer", "default": 50},
                },
                "required": ["folder_path"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["memory:write"],
        ),
        memory_index_directory,
    )

