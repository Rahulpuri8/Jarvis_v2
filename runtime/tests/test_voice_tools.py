import os
import tempfile
import pytest
from runtime.core.registry import ToolRegistry
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.tools.voice import (
    register_voice_tools,
    voice_speak,
    voice_listen,
    voice_status,
    voice_set_voice,
)


def test_voice_tools_registration():
    reg = ToolRegistry()
    register_voice_tools(reg)
    tools = reg.list_tools()
    tool_names = [t.name for t in tools]

    expected = [
        "voice.speak",
        "voice.listen",
        "voice.status",
        "voice.set_voice",
    ]
    for name in expected:
        assert name in tool_names
        defn, handler = reg.get(name)
        assert defn.category == "voice"
        assert callable(handler)


def test_voice_status():
    status = voice_status()
    assert "tts_available" in status
    assert status["tts_available"] is True
    assert "rate" in status
    assert "volume" in status
    assert "voices" in status


def test_voice_speak_to_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        audio_file = os.path.join(tmpdir, "greeting.wav")
        res = voice_speak(text="Hello, I am JARVIS. How may I assist you?", save_to_file=audio_file)
        assert res["spoken"] is True
        assert res["character_count"] > 0
        assert os.path.exists(audio_file)


def test_voice_listen_simulated():
    res = voice_listen(simulate_input="Open Chrome and search for latest AI research")
    assert res["heard"] is True
    assert res["transcription"] == "Open Chrome and search for latest AI research"
    assert res["confidence"] > 0.9


def test_voice_set_voice():
    res = voice_set_voice(rate=190, volume=0.85)
    assert res["status"] == "updated"
    assert res["rate"] == 190
    assert res["volume"] == 0.85


@pytest.mark.asyncio
async def test_voice_gateway_invocation():
    reg = ToolRegistry()
    register_voice_tools(reg)
    gateway = ToolGateway(registry=reg)

    req = ToolRequest(tool="voice.status", arguments={})
    res = await gateway.execute(req)
    assert res.success is True
    assert "tts_available" in res.data
