"""
Unit tests for JARVIS Phase 9 Computer Vision & Screen Grounding Tool Suite.
"""

import os
import pytest
from ..core.registry import ToolRegistry
from ..tools.vision import (
    VisionManager,
    analyze_screen,
    find_element,
    click_element,
    read_text,
    describe_region,
    compare_screens,
    register_vision_tools,
)


@pytest.fixture
def vision_manager():
    return VisionManager.get_instance()


def test_analyze_screen_basic():
    result = analyze_screen()
    assert result["success"] is True
    assert "resolution" in result
    assert result["resolution"]["width"] > 0
    assert result["resolution"]["height"] > 0
    assert result["theme"] in ["dark", "light"]
    assert "luminance" in result
    assert isinstance(result["description"], str)
    assert os.path.exists(result["screenshot_path"])


def test_analyze_screen_with_visual_qa():
    result = analyze_screen(query="Is there any error popup?")
    assert result["success"] is True
    assert result["query"] == "Is there any error popup?"
    assert "answer" in result
    assert isinstance(result["answer"], str)


def test_find_element_anchors():
    # Test close button anchor / element localization
    close_res = find_element(description="close button", element_type="button")
    assert "success" in close_res
    if close_res.get("found"):
        assert "coordinates" in close_res
        assert close_res["coordinates"]["center_x"] >= 0
        assert close_res["coordinates"]["center_y"] >= 0
        assert "bounding_box" in close_res
        assert close_res["confidence"] >= 0.5
    else:
        assert close_res["success"] is False
        assert "message" in close_res

    # Test search bar anchor
    search_res = find_element(description="search bar", element_type="input")
    assert "success" in search_res
    if search_res.get("found"):
        assert "bounding_box" in search_res
    else:
        assert search_res["success"] is False


def test_click_element():
    res = click_element(description="Submit button", click_type="single")
    assert "success" in res
    if res["success"]:
        assert "clicked_at" in res
        assert res["click_type"] == "single"
        assert "bounding_box" in res
    else:
        assert "message" in res

    # Test hover action
    hover_res = click_element(description="Settings gear icon", click_type="hover")
    assert "success" in hover_res
    if hover_res["success"]:
        assert hover_res["click_type"] == "hover"
    else:
        assert "message" in hover_res


def test_read_text_ocr():
    res = read_text()
    assert res["success"] is True
    assert isinstance(res["text"], str)
    assert "blocks" in res
    assert "region" in res


def test_describe_region():
    res = describe_region(x=10, y=10, width=100, height=50, label="Status Badge")
    assert res["success"] is True
    assert res["label"] == "Status Badge"
    assert "dominant_color" in res
    assert "inferred_state" in res
    assert "description" in res
    assert os.path.exists(res["crop_image_path"])


def test_compare_screens():
    # Step 1: establish baseline
    res1 = compare_screens()
    assert res1["success"] is True
    assert "baseline_path" in res1
    baseline_path = res1["baseline_path"]
    assert os.path.exists(baseline_path)

    # Step 2: compare against baseline
    res2 = compare_screens(baseline_path=baseline_path)
    assert res2["success"] is True
    assert "difference_ratio" in res2
    assert "percentage_changed" in res2


def test_vision_tools_registration():
    reg = ToolRegistry()
    register_vision_tools(reg)
    tools = reg.list_tools()
    tool_names = [t.name for t in tools]

    expected = [
        "vision.analyze_screen",
        "vision.find_element",
        "vision.click_element",
        "vision.read_text",
        "vision.describe_region",
        "vision.compare_screens",
    ]

    for exp in expected:
        assert exp in tool_names, f"Missing tool {exp} in registry"
