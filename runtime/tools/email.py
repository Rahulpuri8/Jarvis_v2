"""
Email Management Tool Suite for JARVIS
Supports Google Workspace (Gmail API) with seamless local sandbox/mock fallback
"""

import base64
import json
import os
import uuid
from datetime import datetime
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from ..core.models import ToolDefinition, ToolRiskLevel


class EmailManager:
    _instance: Optional["EmailManager"] = None

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = data_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
        os.makedirs(self.data_dir, exist_ok=True)
        self.sandbox_file = os.path.join(self.data_dir, "sandbox_emails.json")
        self.credentials_path = os.environ.get(
            "GMAIL_CREDENTIALS_PATH",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "credentials.json"),
        )
        self.token_path = os.environ.get(
            "GMAIL_TOKEN_PATH",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "token.json"),
        )
        self._init_sandbox_data()

    @classmethod
    def get_instance(cls) -> "EmailManager":
        if cls._instance is None:
            cls._instance = EmailManager()
        return cls._instance

    def _init_sandbox_data(self) -> None:
        """Initialize sample sandbox emails if no file exists"""
        if not os.path.exists(self.sandbox_file):
            sample_emails = [
                {
                    "id": "msg_001",
                    "thread_id": "th_001",
                    "sender": "sarah.lead@innovate.tech",
                    "sender_name": "Sarah Connor",
                    "to": "me@jarvis.ai",
                    "subject": "Q3 Architecture Review & Roadmap Alignment",
                    "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "unread": True,
                    "snippet": "Hi team, please review the Q3 architecture RFC before our sync tomorrow at 3 PM...",
                    "body": "Hi team,\n\nPlease review the attached Q3 architecture RFC before our sync tomorrow at 3 PM.\nKey discussion points:\n1. Transitioning microservices to event-driven gateway\n2. Electron IPC performance benchmarks\n3. Local LLM agent scaling\n\nBest,\nSarah",
                },
                {
                    "id": "msg_002",
                    "thread_id": "th_002",
                    "sender": "alex.dev@innovate.tech",
                    "sender_name": "Alex Mercer",
                    "to": "me@jarvis.ai",
                    "subject": "PR #42 Ready for Review: Playwright & Python Gateway",
                    "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "unread": True,
                    "snippet": "Added unit test coverage for the tool gateway and browser automation. All CI checks pass...",
                    "body": "Hey,\n\nI just pushed PR #42 with full Playwright async handler support and gateway error recovery. All 25 unit tests are passing.\nCould you take a quick look?\n\nThanks,\nAlex",
                },
                {
                    "id": "msg_003",
                    "thread_id": "th_003",
                    "sender": "notifications@github.com",
                    "sender_name": "GitHub Notifications",
                    "to": "me@jarvis.ai",
                    "subject": "[buildos-ai/jarvis] Security Advisory: Dependency Update Complete",
                    "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "unread": False,
                    "snippet": "All automated security audits completed with 0 vulnerabilities detected...",
                    "body": "Security audit summary for buildos-ai/jarvis:\n0 High vulnerabilities\n0 Medium vulnerabilities\nClean status verified.",
                },
            ]
            with open(self.sandbox_file, "w", encoding="utf-8") as f:
                json.dump(sample_emails, f, indent=2)

    def _load_sandbox(self) -> List[Dict[str, Any]]:
        try:
            with open(self.sandbox_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_sandbox(self, emails: List[Dict[str, Any]]) -> None:
        with open(self.sandbox_file, "w", encoding="utf-8") as f:
            json.dump(emails, f, indent=2)

    def _get_gmail_service(self):
        """Attempts to load real Gmail API service via OAuth2 token if available"""
        if not os.path.exists(self.token_path) and not os.path.exists(self.credentials_path):
            return None
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            if os.path.exists(self.token_path):
                creds = Credentials.from_authorized_user_file(
                    self.token_path,
                    ["https://www.googleapis.com/auth/gmail.modify"],
                )
                if creds and creds.valid:
                    return build("gmail", "v1", credentials=creds)
        except Exception:
            pass
        return None

    def list_unread(self, limit: int = 10) -> Dict[str, Any]:
        """Fetch list of recent unread emails"""
        service = self._get_gmail_service()
        if service:
            try:
                results = service.users().messages().list(userId="me", q="is:unread", maxResults=limit).execute()
                messages = results.get("messages", [])
                email_list = []
                for msg in messages:
                    detail = service.users().messages().get(userId="me", id=msg["id"], format="metadata").execute()
                    headers = {h["name"].lower(): h["value"] for h in detail.get("payload", {}).get("headers", [])}
                    email_list.append({
                        "id": msg["id"],
                        "thread_id": msg.get("threadId"),
                        "sender": headers.get("from", "Unknown"),
                        "subject": headers.get("subject", "(No Subject)"),
                        "date": headers.get("date", ""),
                        "snippet": detail.get("snippet", ""),
                        "unread": True,
                    })
                return {
                    "mode": "live_gmail",
                    "count": len(email_list),
                    "emails": email_list,
                }
            except Exception as e:
                return {"mode": "error", "error": f"Gmail API error: {str(e)}"}

        # Sandbox Fallback
        emails = self._load_sandbox()
        unread = [e for e in emails if e.get("unread", True)][:limit]
        return {
            "mode": "sandbox",
            "count": len(unread),
            "emails": unread,
            "note": "Operating in local sandbox mode. Link credentials.json in Settings for live Google Workspace sync.",
        }

    def search(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """Search emails by query terms or sender/subject"""
        service = self._get_gmail_service()
        if service:
            try:
                results = service.users().messages().list(userId="me", q=query, maxResults=limit).execute()
                messages = results.get("messages", [])
                email_list = []
                for msg in messages:
                    detail = service.users().messages().get(userId="me", id=msg["id"], format="metadata").execute()
                    headers = {h["name"].lower(): h["value"] for h in detail.get("payload", {}).get("headers", [])}
                    email_list.append({
                        "id": msg["id"],
                        "thread_id": msg.get("threadId"),
                        "sender": headers.get("from", "Unknown"),
                        "subject": headers.get("subject", "(No Subject)"),
                        "date": headers.get("date", ""),
                        "snippet": detail.get("snippet", ""),
                    })
                return {
                    "mode": "live_gmail",
                    "query": query,
                    "count": len(email_list),
                    "emails": email_list,
                }
            except Exception as e:
                return {"mode": "error", "error": f"Gmail search error: {str(e)}"}

        # Sandbox Search
        emails = self._load_sandbox()
        q = query.lower()
        matched = []
        for e in emails:
            content = f"{e.get('sender', '')} {e.get('subject', '')} {e.get('snippet', '')} {e.get('body', '')}".lower()
            if q in content or any(term in content for term in q.split()):
                matched.append(e)
            if len(matched) >= limit:
                break
        return {
            "mode": "sandbox",
            "query": query,
            "count": len(matched),
            "emails": matched,
            "note": "Operating in local sandbox mode.",
        }

    def read(self, email_id: str) -> Dict[str, Any]:
        """Retrieve full details and body of a specific email"""
        service = self._get_gmail_service()
        if service:
            try:
                detail = service.users().messages().get(userId="me", id=email_id, format="full").execute()
                headers = {h["name"].lower(): h["value"] for h in detail.get("payload", {}).get("headers", [])}
                body_data = ""
                payload = detail.get("payload", {})
                if "parts" in payload:
                    for part in payload["parts"]:
                        if part.get("mimeType") == "text/plain":
                            data = part.get("body", {}).get("data", "")
                            if data:
                                body_data = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                                break
                elif "body" in payload and payload["body"].get("data"):
                    body_data = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")

                return {
                    "mode": "live_gmail",
                    "id": email_id,
                    "sender": headers.get("from", ""),
                    "to": headers.get("to", ""),
                    "subject": headers.get("subject", ""),
                    "date": headers.get("date", ""),
                    "body": body_data or detail.get("snippet", ""),
                }
            except Exception as e:
                return {"mode": "error", "error": f"Could not read email {email_id}: {str(e)}"}

        # Sandbox read
        emails = self._load_sandbox()
        for e in emails:
            if e.get("id") == email_id:
                # Mark as read
                e["unread"] = False
                self._save_sandbox(emails)
                return {
                    "mode": "sandbox",
                    "id": e["id"],
                    "sender": e.get("sender", ""),
                    "to": e.get("to", ""),
                    "subject": e.get("subject", ""),
                    "date": e.get("date", ""),
                    "snippet": e.get("snippet", ""),
                    "body": e.get("body", ""),
                }
        return {"error": f"Email with ID '{email_id}' not found."}

    def draft(self, to: str, subject: str, body: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
        """Prepare and save an email draft"""
        service = self._get_gmail_service()
        if service:
            try:
                message = MIMEText(body)
                message["to"] = to
                message["subject"] = subject
                raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
                draft_body = {"message": {"raw": raw}}
                if thread_id:
                    draft_body["message"]["threadId"] = thread_id
                draft = service.users().drafts().create(userId="me", body=draft_body).execute()
                return {
                    "mode": "live_gmail",
                    "draft_id": draft["id"],
                    "to": to,
                    "subject": subject,
                    "status": "draft_created",
                }
            except Exception as e:
                return {"mode": "error", "error": f"Failed to create draft: {str(e)}"}

        # Sandbox draft
        draft_id = f"draft_{uuid.uuid4().hex[:8]}"
        draft_email = {
            "id": draft_id,
            "thread_id": thread_id or f"th_{uuid.uuid4().hex[:6]}",
            "sender": "me@jarvis.ai",
            "sender_name": "Me (JARVIS)",
            "to": to,
            "subject": f"[Draft] {subject}",
            "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "unread": False,
            "snippet": body[:120],
            "body": body,
            "is_draft": True,
        }
        emails = self._load_sandbox()
        emails.insert(0, draft_email)
        self._save_sandbox(emails)
        return {
            "mode": "sandbox",
            "draft_id": draft_id,
            "to": to,
            "subject": subject,
            "status": "draft_created",
            "note": "Draft saved in sandbox email store.",
        }

    def send(self, to: str, subject: str, body: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
        """Send an email to recipient [Requires User Approval]"""
        service = self._get_gmail_service()
        if service:
            try:
                message = MIMEText(body)
                message["to"] = to
                message["subject"] = subject
                raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
                send_body = {"raw": raw}
                if thread_id:
                    send_body["threadId"] = thread_id
                sent = service.users().messages().send(userId="me", body=send_body).execute()
                return {
                    "mode": "live_gmail",
                    "message_id": sent["id"],
                    "to": to,
                    "subject": subject,
                    "status": "sent",
                    "timestamp": datetime.now().isoformat(),
                }
            except Exception as e:
                return {"mode": "error", "error": f"Failed to send email: {str(e)}"}

        # Sandbox Send
        msg_id = f"sent_{uuid.uuid4().hex[:8]}"
        sent_email = {
            "id": msg_id,
            "thread_id": thread_id or f"th_{uuid.uuid4().hex[:6]}",
            "sender": "me@jarvis.ai",
            "sender_name": "Me (JARVIS)",
            "to": to,
            "subject": subject,
            "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "unread": False,
            "snippet": body[:120],
            "body": body,
            "sent": True,
        }
        emails = self._load_sandbox()
        emails.insert(0, sent_email)
        self._save_sandbox(emails)
        return {
            "mode": "sandbox",
            "message_id": msg_id,
            "to": to,
            "subject": subject,
            "status": "sent",
            "timestamp": datetime.now().isoformat(),
            "note": "Email dispatched in sandbox mode.",
        }


# ==========================================
# Tool Wrappers for JARVIS Tool Gateway
# ==========================================

email_manager = EmailManager.get_instance()


def email_list_unread(limit: int = 10, **kwargs) -> Dict[str, Any]:
    return email_manager.list_unread(limit=limit)


def email_search(query: str = "", limit: int = 10, **kwargs) -> Dict[str, Any]:
    return email_manager.search(query=query, limit=limit)


def email_read(email_id: str = "", id: str = "", **kwargs) -> Dict[str, Any]:
    target_id = email_id or id or kwargs.get("message_id", "")
    return email_manager.read(email_id=target_id)


def email_draft(to: str = "", subject: str = "", body: str = "", thread_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    return email_manager.draft(to=to, subject=subject, body=body, thread_id=thread_id)


def email_send(to: str = "", subject: str = "", body: str = "", thread_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    return email_manager.send(to=to, subject=subject, body=body, thread_id=thread_id)


def register_email_tools(registry) -> None:
    registry.register(
        ToolDefinition(
            name="email.list_unread",
            description="Fetch recent unread emails with sender, subject, date, and preview snippet.",
            category="email",
            arguments_schema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Maximum number of unread emails to retrieve (default: 10)"},
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["email:read"],
        ),
        email_list_unread,
    )

    registry.register(
        ToolDefinition(
            name="email.search",
            description="Search emails by sender, subject, keywords, or query criteria.",
            category="email",
            arguments_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query e.g. 'from:sarah', 'invoice', 'meeting'"},
                    "limit": {"type": "integer", "description": "Maximum results to return"},
                },
                "required": ["query"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["email:read"],
        ),
        email_search,
    )

    registry.register(
        ToolDefinition(
            name="email.read",
            description="Retrieve full email content and body by email ID.",
            category="email",
            arguments_schema={
                "type": "object",
                "properties": {
                    "email_id": {"type": "string", "description": "ID of the email to retrieve"},
                },
                "required": ["email_id"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["email:read"],
        ),
        email_read,
    )

    registry.register(
        ToolDefinition(
            name="email.draft",
            description="Prepare and save an email draft for user confirmation.",
            category="email",
            arguments_schema={
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Recipient email address"},
                    "subject": {"type": "string", "description": "Subject of the email"},
                    "body": {"type": "string", "description": "Body text of the message"},
                    "thread_id": {"type": "string", "description": "Optional thread ID to reply to"},
                },
                "required": ["to", "subject", "body"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["email:read"],
        ),
        email_draft,
    )

    registry.register(
        ToolDefinition(
            name="email.send",
            description="Send an email to a recipient. Requires user approval.",
            category="email",
            arguments_schema={
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Recipient email address"},
                    "subject": {"type": "string", "description": "Subject of the email"},
                    "body": {"type": "string", "description": "Body text of the message"},
                    "thread_id": {"type": "string", "description": "Optional thread ID to reply to"},
                },
                "required": ["to", "subject", "body"],
            },
            risk_level=ToolRiskLevel.EXTERNAL_WRITE,
            permissions=["email:send"],
        ),
        email_send,
    )

