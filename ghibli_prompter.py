"""
Ghibli-Style AI Video Prompt Generator

Generates end-to-end, scene-by-scene prompts for creating Studio Ghibli-style
AI videos. Supports multiple AI video platforms (Sora, Runway, Kling, Pika)
and integrates with the existing LLM agent for intelligent prompt expansion.

Usage:
    from ghibli_prompter import GhibliPromptGenerator

    gen = GhibliPromptGenerator()
    video = gen.generate_video_prompts(
        concept="A lonely girl discovers a hidden garden of forest spirits",
        num_scenes=6,
        platform="sora",
    )
    video.print_storyboard()
"""

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

try:
    from llm_agent import LLM, LLMType, Models
    _LLM_AVAILABLE = True
except ImportError:
    _LLM_AVAILABLE = False
    LLM = None
    LLMType = None
    Models = None


# ---------------------------------------------------------------------------
# Constants: Ghibli aesthetic knowledge base (distilled from research)
# ---------------------------------------------------------------------------

class Platform(str, Enum):
    SORA = "sora"
    RUNWAY = "runway"
    KLING = "kling"
    PIKA = "pika"
    GENERIC = "generic"


class AspectRatio(str, Enum):
    CINEMATIC = "16:9"
    PORTRAIT = "9:16"
    SQUARE = "1:1"


GHIBLI_STYLE_ANCHORS = [
    "Studio Ghibli style",
    "Hayao Miyazaki-inspired animation",
    "hand-drawn cel animation aesthetic",
    "watercolor painted backgrounds",
]

GHIBLI_COLOR_PALETTES = {
    "countryside": "sage green, sky blue, warm cream, golden wheat, terracotta accents",
    "forest": "deep emerald, moss green, dappled gold, misty gray, bark brown",
    "ocean": "cerulean blue, seafoam green, pearl white, coral pink, sandy beige",
    "twilight": "lavender purple, dusty rose, deep indigo, warm amber, pale gold",
    "spirit_world": "ethereal teal, glowing cyan, deep crimson, midnight blue, soft violet",
    "village": "warm ochre, slate blue, faded red, forest green, soft brown",
    "sky": "powder blue, cloud white, sunset orange, gentle pink, pale yellow",
}

GHIBLI_LIGHTING = {
    "morning": "soft golden morning light, gentle long shadows, warm diffused glow",
    "midday": "bright natural sunlight, vibrant colors, clear atmosphere",
    "golden_hour": "warm golden hour light, rich amber tones, elongated soft shadows",
    "sunset": "orange and pink sunset glow, silhouetted elements, warm atmospheric haze",
    "twilight": "cool blue twilight, first stars appearing, soft ambient luminescence",
    "night": "soft moonlight, gentle blue-silver illumination, glowing warm windows",
    "overcast": "soft diffused overcast light, muted even illumination, gentle contrast",
    "forest_dappled": "sunlight filtering through leaves, irregular organic light patterns, shifting leaf shadows",
    "rain": "gray diffused light, reflective wet surfaces, occasional lightning glow",
    "indoor_warm": "warm lamplight, cozy amber glow, soft window light mixing with interior warmth",
}

CAMERA_MOVEMENTS = {
    "establishing": "Wide establishing shot, slow gentle pan revealing the landscape",
    "follow": "Tracking shot, camera follows the character from behind at walking pace",
    "dolly_in": "Slow dolly forward, gradually drawing closer to the subject",
    "crane_up": "Camera slowly rises upward, revealing the scale of the environment",
    "tilt_up": "Gentle tilt upward from ground level to the sky",
    "orbit": "Slow cinematic arc orbiting around the subject",
    "static": "Static locked-off frame, quiet contemplative composition",
    "aerial": "High aerial view drifting gently over the landscape",
    "close_up": "Close-up shot with shallow depth, focusing on emotion and detail",
    "pan_landscape": "Slow horizontal pan across an expansive vista",
}

GHIBLI_MOOD_KEYWORDS = {
    "wonder": "childlike wonder, magical discovery, eyes wide with awe",
    "melancholy": "bittersweet nostalgia, quiet longing, gentle sadness",
    "adventure": "determined spirit, wind in hair, boundless horizon ahead",
    "peace": "serene tranquility, gentle breeze, perfect stillness",
    "mystery": "ancient secrets, mist-shrouded paths, whispered legends",
    "joy": "pure delight, laughter carried on the wind, warm embrace of belonging",
    "courage": "quiet resolve, standing tall against the storm, inner strength",
    "love": "tender connection, unspoken understanding, warmth between souls",
}

GHIBLI_ENVIRONMENTS = {
    "countryside": "rolling green hills dotted with wildflowers, winding dirt paths, small rustic cottages, distant mountains",
    "forest": "ancient towering trees with moss-covered roots, glowing particles drifting in shafts of light, hidden streams",
    "village": "traditional wooden houses with tiled roofs, narrow cobblestone streets, hanging laundry, market stalls",
    "ocean": "vast sparkling sea stretching to the horizon, gentle waves lapping at rocky shores, seabirds gliding overhead",
    "sky": "towering cumulus clouds like floating islands, endless blue expanse, birds soaring on thermals",
    "mountain": "snow-capped peaks above the clouds, alpine meadows with edelweiss, steep rocky paths",
    "spirit_world": "floating lanterns, impossible architecture, shimmering translucent beings, distorted perspectives",
    "ruins": "overgrown stone ruins reclaimed by nature, crumbling walls wrapped in ivy, wildflowers in cracked floors",
    "garden": "lush walled garden overflowing with flowers, stone fountain with clear water, butterflies and bees",
    "interior": "cozy wooden interior, warm hearth fire, steaming kettle, shelves of jars and dried herbs",
}

SCENE_TYPES = {
    "opening": "Establishing shot introducing the world and atmosphere",
    "character_intro": "First appearance of the main character in their element",
    "discovery": "Character encounters something unexpected or magical",
    "journey": "Character traveling through the landscape, sense of movement",
    "quiet_moment": "Slice-of-life beat, mundane magic, contemplative pause",
    "confrontation": "Tension or challenge the character must face",
    "climax": "The peak emotional or dramatic moment",
    "resolution": "Calm after the storm, new understanding",
    "closing": "Final wide shot, the world continues, bittersweet farewell",
    "transition": "Bridge shot between major scenes, environmental detail",
}

# Platform-specific prompt templates
PLATFORM_TEMPLATES = {
    Platform.SORA: (
        "{style_anchor}. {camera}. {subject_action}. "
        "{environment}. {lighting}. {color_palette}. "
        "{mood}. {texture}. {duration}"
    ),
    Platform.RUNWAY: (
        "{camera}, {subject_action}, {camera_movement}, "
        "{lighting}, {style_anchor}, {mood}. "
        "{environment}. {color_palette}. {texture}. {negative}"
    ),
    Platform.KLING: (
        "{subject_action}. {environment}. {camera}. "
        "{style_anchor}. {lighting}. {mood}. "
        "{color_palette}. {texture}. {negative}"
    ),
    Platform.PIKA: (
        "{style_anchor}, {subject_action}, {environment}, "
        "{lighting}, {mood}, {camera}. {texture}"
    ),
    Platform.GENERIC: (
        "{style_anchor}. {camera}. {subject_action}. "
        "{environment}. {lighting}. {color_palette}. "
        "{mood}. {texture}. {duration}"
    ),
}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ScenePrompt:
    """A single scene prompt for AI video generation."""
    scene_number: int
    scene_type: str
    description: str
    prompt: str
    camera: str
    environment: str
    lighting: str
    mood: str
    duration_seconds: int = 10
    notes: str = ""

    def to_dict(self):
        return {
            "scene_number": self.scene_number,
            "scene_type": self.scene_type,
            "description": self.description,
            "prompt": self.prompt,
            "camera": self.camera,
            "environment": self.environment,
            "lighting": self.lighting,
            "mood": self.mood,
            "duration_seconds": self.duration_seconds,
            "notes": self.notes,
        }


@dataclass
class VideoStoryboard:
    """Complete storyboard with all scene prompts for a Ghibli-style video."""
    title: str
    concept: str
    platform: str
    aspect_ratio: str
    total_duration: int
    style_notes: str
    scenes: list = field(default_factory=list)

    def add_scene(self, scene: ScenePrompt):
        self.scenes.append(scene)

    def print_storyboard(self):
        separator = "=" * 70
        print(f"\n{separator}")
        print(f"  GHIBLI-STYLE VIDEO STORYBOARD")
        print(f"{separator}")
        print(f"  Title:      {self.title}")
        print(f"  Concept:    {self.concept}")
        print(f"  Platform:   {self.platform}")
        print(f"  Aspect:     {self.aspect_ratio}")
        print(f"  Duration:   ~{self.total_duration}s")
        print(f"  Style:      {self.style_notes}")
        print(f"{separator}\n")

        for scene in self.scenes:
            print(f"--- Scene {scene.scene_number}: {scene.scene_type.upper()} ---")
            print(f"  Description : {scene.description}")
            print(f"  Camera      : {scene.camera}")
            print(f"  Environment : {scene.environment}")
            print(f"  Lighting    : {scene.lighting}")
            print(f"  Mood        : {scene.mood}")
            print(f"  Duration    : {scene.duration_seconds}s")
            if scene.notes:
                print(f"  Notes       : {scene.notes}")
            print(f"\n  PROMPT:\n  {scene.prompt}\n")

    def to_dict(self):
        return {
            "title": self.title,
            "concept": self.concept,
            "platform": self.platform,
            "aspect_ratio": self.aspect_ratio,
            "total_duration": self.total_duration,
            "style_notes": self.style_notes,
            "scenes": [s.to_dict() for s in self.scenes],
        }

    def to_json(self, indent=2):
        return json.dumps(self.to_dict(), indent=indent)

    def get_all_prompts(self):
        """Return just the prompt strings for easy copy-paste into AI tools."""
        return [
            {"scene": s.scene_number, "type": s.scene_type, "prompt": s.prompt}
            for s in self.scenes
        ]


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

class GhibliPromptGenerator:
    """
    Generates end-to-end, scene-by-scene prompts for Ghibli-style AI videos.

    Supports two modes:
      1. LLM-powered (default): Uses an LLM to intelligently expand a concept
         into a full storyboard with rich scene descriptions.
      2. Template-only: Uses built-in knowledge base without LLM calls,
         useful when no API keys are available.

    Example:
        gen = GhibliPromptGenerator()
        storyboard = gen.generate_video_prompts(
            concept="A girl discovers a secret garden guarded by forest spirits",
            num_scenes=6,
            platform="sora",
        )
        storyboard.print_storyboard()
    """

    def __init__(self, llm: Optional[LLM] = None):
        self.llm = llm

    def _get_llm(self):
        if self.llm:
            return self.llm
        if not _LLM_AVAILABLE:
            raise RuntimeError(
                "LLM dependencies not installed. Use use_llm=False for template mode, "
                "or install dependencies: pip install -r requirements.txt"
            )
        return LLM(llm_type=LLMType.OPENAI, model=Models.GPT4o)

    # ----- LLM-powered scene generation -----

    def _build_scene_generation_prompt(
        self,
        concept: str,
        num_scenes: int,
        environment: str,
        mood: str,
        platform: str,
        aspect_ratio: str,
        duration_per_scene: int,
        character_description: str,
    ) -> str:
        env_desc = GHIBLI_ENVIRONMENTS.get(environment, environment)
        mood_desc = GHIBLI_MOOD_KEYWORDS.get(mood, mood)
        scene_type_list = ", ".join(SCENE_TYPES.keys())
        camera_list = "\n".join(f"  - {k}: {v}" for k, v in CAMERA_MOVEMENTS.items())
        lighting_list = "\n".join(f"  - {k}: {v}" for k, v in GHIBLI_LIGHTING.items())
        palette_list = "\n".join(f"  - {k}: {v}" for k, v in GHIBLI_COLOR_PALETTES.items())

        prompt = f"""You are an expert Studio Ghibli storyboard artist and AI video prompt engineer.

Given a video concept, generate a detailed scene-by-scene storyboard for a Ghibli-style animated short.

CONCEPT: {concept}
NUMBER OF SCENES: {num_scenes}
TARGET PLATFORM: {platform}
ASPECT RATIO: {aspect_ratio}
DURATION PER SCENE: ~{duration_per_scene} seconds
PRIMARY ENVIRONMENT: {env_desc}
PRIMARY MOOD: {mood_desc}
CHARACTER: {character_description}

GHIBLI STYLE RULES:
- Every scene must feel hand-drawn with watercolor backgrounds and soft lines
- Use "mundane magic" moments: quiet beats of characters eating, walking, or watching nature
- Environments are characters themselves -- include specific natural details (individual leaves, grass blades, water ripples)
- Colors should be muted and earthy with selective vibrant accents
- Lighting shifts to convey time of day and emotion
- Camera movements should be gentle and deliberate, never jarring
- Include foreground/midground/background depth layers
- Characters show emotion through whole-face micro-expressions and body language
- Wind should affect hair, clothing, and foliage naturally

AVAILABLE SCENE TYPES: {scene_type_list}

AVAILABLE CAMERA MOVEMENTS:
{camera_list}

AVAILABLE LIGHTING:
{lighting_list}

AVAILABLE COLOR PALETTES:
{palette_list}

For each scene, provide:
1. scene_type: one of the available scene types
2. description: a 1-2 sentence narrative description of what happens
3. subject_action: specific description of the character/subject and what they are doing (use active kinetic verbs)
4. environment_detail: specific environmental details for this scene
5. camera_key: one of the available camera movement keys
6. lighting_key: one of the available lighting keys
7. palette_key: one of the available color palette keys
8. mood_key: the emotional tone (wonder, melancholy, adventure, peace, mystery, joy, courage, love)
9. notes: any special effects, particles, or details (floating petals, fireflies, dust motes, etc.)

Return ONLY valid JSON with this structure:
{{
  "title": "short evocative title for the video",
  "style_notes": "brief overall style direction",
  "scenes": [
    {{
      "scene_type": "opening",
      "description": "...",
      "subject_action": "...",
      "environment_detail": "...",
      "camera_key": "establishing",
      "lighting_key": "morning",
      "palette_key": "countryside",
      "mood_key": "wonder",
      "notes": "..."
    }}
  ]
}}"""
        return prompt

    def _format_scene_prompt(
        self,
        scene_data: dict,
        platform: Platform,
        aspect_ratio: str,
        duration: int,
        character_description: str,
    ) -> str:
        """Assemble a platform-specific prompt string from scene data."""
        camera_key = scene_data.get("camera_key", "establishing")
        lighting_key = scene_data.get("lighting_key", "morning")
        palette_key = scene_data.get("palette_key", "countryside")
        mood_key = scene_data.get("mood_key", "wonder")

        style_anchor = "Studio Ghibli style, hand-drawn cel animation, watercolor painted backgrounds, soft lines"
        camera = CAMERA_MOVEMENTS.get(camera_key, CAMERA_MOVEMENTS["establishing"])
        camera_movement = camera.split(",")[-1].strip() if "," in camera else ""
        lighting = GHIBLI_LIGHTING.get(lighting_key, GHIBLI_LIGHTING["morning"])
        color_palette = GHIBLI_COLOR_PALETTES.get(palette_key, GHIBLI_COLOR_PALETTES["countryside"])
        mood = GHIBLI_MOOD_KEYWORDS.get(mood_key, GHIBLI_MOOD_KEYWORDS["wonder"])

        subject_action = scene_data.get("subject_action", "")
        if character_description and character_description.lower() not in subject_action.lower():
            subject_action = f"{character_description}, {subject_action}"

        environment = scene_data.get("environment_detail", "")
        notes = scene_data.get("notes", "")
        texture = "Hand-painted watercolor texture, analog film grain, 1990s anime production quality"
        duration_str = f"{duration}-second clip, high resolution, {aspect_ratio}"
        negative = "Negative prompt: blurry, low quality, 3D render, photorealistic, extra limbs, text, watermark"

        template = PLATFORM_TEMPLATES.get(platform, PLATFORM_TEMPLATES[Platform.GENERIC])
        prompt = template.format(
            style_anchor=style_anchor,
            camera=camera,
            camera_movement=camera_movement,
            subject_action=subject_action,
            environment=environment,
            lighting=lighting,
            color_palette=f"Color palette: {color_palette}",
            mood=f"Mood: {mood}",
            texture=texture,
            duration=duration_str,
            negative=negative,
        )

        if notes:
            prompt += f" Details: {notes}."

        return prompt

    def generate_video_prompts(
        self,
        concept: str,
        num_scenes: int = 6,
        platform: str = "sora",
        aspect_ratio: str = "16:9",
        duration_per_scene: int = 10,
        environment: str = "countryside",
        mood: str = "wonder",
        character_description: str = "A young girl with short brown hair wearing a simple white dress",
        use_llm: bool = True,
    ) -> VideoStoryboard:
        """
        Generate a complete Ghibli-style video storyboard.

        Args:
            concept: The story idea or video concept.
            num_scenes: Number of scenes to generate (3-12 recommended).
            platform: Target AI video platform (sora, runway, kling, pika, generic).
            aspect_ratio: Output aspect ratio (16:9, 9:16, 1:1).
            duration_per_scene: Target duration per clip in seconds.
            environment: Primary environment theme.
            mood: Primary mood/emotion.
            character_description: Description of the main character.
            use_llm: If True, use LLM for intelligent scene expansion.
                     If False, use template-based generation.

        Returns:
            VideoStoryboard with all scene prompts ready for use.
        """
        plat = Platform(platform.lower()) if platform.lower() in [p.value for p in Platform] else Platform.GENERIC

        if use_llm:
            return self._generate_with_llm(
                concept, num_scenes, plat, aspect_ratio,
                duration_per_scene, environment, mood, character_description,
            )
        else:
            return self._generate_from_templates(
                concept, num_scenes, plat, aspect_ratio,
                duration_per_scene, environment, mood, character_description,
            )

    def _generate_with_llm(
        self,
        concept: str,
        num_scenes: int,
        platform: Platform,
        aspect_ratio: str,
        duration_per_scene: int,
        environment: str,
        mood: str,
        character_description: str,
    ) -> VideoStoryboard:
        """Use LLM to intelligently expand concept into scenes, then format prompts."""
        llm = self._get_llm()

        system_prompt = self._build_scene_generation_prompt(
            concept, num_scenes, environment, mood,
            platform.value, aspect_ratio, duration_per_scene,
            character_description,
        )

        response = llm.chat(message=system_prompt)

        # Parse LLM response
        raw_text = ""
        if llm.type == LLMType.OPENAI:
            raw_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        elif llm.type == LLMType.GEMINI:
            raw_text = str(response)
        elif llm.type == LLMType.CLAUDE:
            raw_text = response.get("response", "")

        raw_text = raw_text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
        if raw_text.endswith("```"):
            raw_text = raw_text.rsplit("```", 1)[0]
        raw_text = raw_text.strip()

        try:
            scene_data = json.loads(raw_text)
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            start = raw_text.find("{")
            end = raw_text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    scene_data = json.loads(raw_text[start:end])
                except json.JSONDecodeError:
                    print("Warning: Could not parse LLM response. Falling back to templates.")
                    return self._generate_from_templates(
                        concept, num_scenes, platform, aspect_ratio,
                        duration_per_scene, environment, mood, character_description,
                    )
            else:
                print("Warning: No JSON found in LLM response. Falling back to templates.")
                return self._generate_from_templates(
                    concept, num_scenes, platform, aspect_ratio,
                    duration_per_scene, environment, mood, character_description,
                )

        title = scene_data.get("title", "Untitled Ghibli Short")
        style_notes = scene_data.get("style_notes", "Studio Ghibli hand-drawn animation style")
        scenes_raw = scene_data.get("scenes", [])

        storyboard = VideoStoryboard(
            title=title,
            concept=concept,
            platform=platform.value,
            aspect_ratio=aspect_ratio,
            total_duration=len(scenes_raw) * duration_per_scene,
            style_notes=style_notes,
        )

        for i, s in enumerate(scenes_raw):
            prompt_str = self._format_scene_prompt(
                s, platform, aspect_ratio, duration_per_scene, character_description,
            )
            scene = ScenePrompt(
                scene_number=i + 1,
                scene_type=s.get("scene_type", "transition"),
                description=s.get("description", ""),
                prompt=prompt_str,
                camera=CAMERA_MOVEMENTS.get(s.get("camera_key", "establishing"), ""),
                environment=s.get("environment_detail", ""),
                lighting=GHIBLI_LIGHTING.get(s.get("lighting_key", "morning"), ""),
                mood=GHIBLI_MOOD_KEYWORDS.get(s.get("mood_key", "wonder"), ""),
                duration_seconds=duration_per_scene,
                notes=s.get("notes", ""),
            )
            storyboard.add_scene(scene)

        return storyboard

    def _generate_from_templates(
        self,
        concept: str,
        num_scenes: int,
        platform: Platform,
        aspect_ratio: str,
        duration_per_scene: int,
        environment: str,
        mood: str,
        character_description: str,
    ) -> VideoStoryboard:
        """Generate prompts using built-in templates (no LLM needed)."""

        # Build a narrative arc from scene types
        arc_templates = {
            3: ["opening", "discovery", "closing"],
            4: ["opening", "character_intro", "discovery", "closing"],
            5: ["opening", "character_intro", "journey", "discovery", "closing"],
            6: ["opening", "character_intro", "journey", "discovery", "quiet_moment", "closing"],
            7: ["opening", "character_intro", "journey", "discovery", "quiet_moment", "climax", "closing"],
            8: ["opening", "character_intro", "journey", "discovery", "quiet_moment", "confrontation", "climax", "closing"],
        }

        if num_scenes in arc_templates:
            arc = arc_templates[num_scenes]
        elif num_scenes < 3:
            arc = ["opening", "closing"][:num_scenes]
        else:
            base = arc_templates[8]
            arc = base[:num_scenes] if num_scenes <= 8 else base + ["transition"] * (num_scenes - 8)

        # Map lighting to time progression
        time_progression = [
            "morning", "morning", "midday", "golden_hour",
            "golden_hour", "sunset", "twilight", "night",
            "night", "twilight", "morning", "midday",
        ]

        env_key = environment if environment in GHIBLI_ENVIRONMENTS else "countryside"
        mood_key = mood if mood in GHIBLI_MOOD_KEYWORDS else "wonder"

        storyboard = VideoStoryboard(
            title=f"Ghibli Short: {concept[:50]}",
            concept=concept,
            platform=platform.value,
            aspect_ratio=aspect_ratio,
            total_duration=num_scenes * duration_per_scene,
            style_notes="Studio Ghibli hand-drawn animation, watercolor backgrounds, soft natural palette",
        )

        camera_keys = list(CAMERA_MOVEMENTS.keys())
        palette_keys = list(GHIBLI_COLOR_PALETTES.keys())

        for i, scene_type in enumerate(arc):
            lighting_key = time_progression[i % len(time_progression)]
            camera_key = camera_keys[i % len(camera_keys)]
            palette = palette_keys[i % len(palette_keys)]

            scene_data = {
                "scene_type": scene_type,
                "subject_action": f"{character_description} in a scene depicting: {concept}",
                "environment_detail": GHIBLI_ENVIRONMENTS[env_key],
                "camera_key": camera_key,
                "lighting_key": lighting_key,
                "palette_key": palette,
                "mood_key": mood_key,
                "notes": "Floating particles in the air, gentle wind affecting foliage and clothing",
            }

            prompt_str = self._format_scene_prompt(
                scene_data, platform, aspect_ratio, duration_per_scene, character_description,
            )

            scene = ScenePrompt(
                scene_number=i + 1,
                scene_type=scene_type,
                description=f"{SCENE_TYPES[scene_type]} - {concept}",
                prompt=prompt_str,
                camera=CAMERA_MOVEMENTS[camera_key],
                environment=GHIBLI_ENVIRONMENTS[env_key],
                lighting=GHIBLI_LIGHTING[lighting_key],
                mood=GHIBLI_MOOD_KEYWORDS[mood_key],
                duration_seconds=duration_per_scene,
                notes=scene_data["notes"],
            )
            storyboard.add_scene(scene)

        return storyboard


# ---------------------------------------------------------------------------
# Convenience functions
# ---------------------------------------------------------------------------

def generate_single_prompt(
    description: str,
    platform: str = "generic",
    environment: str = "countryside",
    lighting: str = "golden_hour",
    mood: str = "wonder",
    camera: str = "establishing",
    aspect_ratio: str = "16:9",
    duration: int = 10,
) -> str:
    """
    Generate a single Ghibli-style prompt for a one-off scene.

    Useful when you don't need a full storyboard but just want one
    well-crafted prompt with all the Ghibli aesthetic details.

    Args:
        description: What happens in the scene.
        platform: Target AI video platform.
        environment: Environment key or free-text description.
        lighting: Lighting key from GHIBLI_LIGHTING.
        mood: Mood key from GHIBLI_MOOD_KEYWORDS.
        camera: Camera movement key from CAMERA_MOVEMENTS.
        aspect_ratio: Output aspect ratio.
        duration: Clip duration in seconds.

    Returns:
        A formatted prompt string ready for the target platform.
    """
    plat = Platform(platform.lower()) if platform.lower() in [p.value for p in Platform] else Platform.GENERIC

    env_desc = GHIBLI_ENVIRONMENTS.get(environment, environment)

    scene_data = {
        "subject_action": description,
        "environment_detail": env_desc,
        "camera_key": camera,
        "lighting_key": lighting,
        "palette_key": environment if environment in GHIBLI_COLOR_PALETTES else "countryside",
        "mood_key": mood,
        "notes": "",
    }

    gen = GhibliPromptGenerator()
    return gen._format_scene_prompt(scene_data, plat, aspect_ratio, duration, "")


def list_options():
    """Print all available options for environments, moods, lighting, cameras, etc."""
    print("=== ENVIRONMENTS ===")
    for k, v in GHIBLI_ENVIRONMENTS.items():
        print(f"  {k}: {v[:80]}...")
    print("\n=== MOODS ===")
    for k, v in GHIBLI_MOOD_KEYWORDS.items():
        print(f"  {k}: {v}")
    print("\n=== LIGHTING ===")
    for k, v in GHIBLI_LIGHTING.items():
        print(f"  {k}: {v}")
    print("\n=== CAMERA MOVEMENTS ===")
    for k, v in CAMERA_MOVEMENTS.items():
        print(f"  {k}: {v}")
    print("\n=== COLOR PALETTES ===")
    for k, v in GHIBLI_COLOR_PALETTES.items():
        print(f"  {k}: {v}")
    print("\n=== PLATFORMS ===")
    for p in Platform:
        print(f"  {p.value}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate Ghibli-style AI video prompts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full storyboard with LLM
  python ghibli_prompter.py --concept "A cat spirit guides a lost child home" --scenes 6

  # Single prompt without LLM
  python ghibli_prompter.py --single "A girl flies on a broomstick over a coastal town at sunset"

  # Template-only mode (no API keys needed)
  python ghibli_prompter.py --concept "Forest spirits awakening" --no-llm --scenes 4

  # List all available options
  python ghibli_prompter.py --list-options
        """,
    )

    parser.add_argument("--concept", type=str, help="Video concept/story idea")
    parser.add_argument("--single", type=str, help="Generate a single scene prompt")
    parser.add_argument("--scenes", type=int, default=6, help="Number of scenes (default: 6)")
    parser.add_argument("--platform", type=str, default="sora", choices=["sora", "runway", "kling", "pika", "generic"])
    parser.add_argument("--aspect", type=str, default="16:9", choices=["16:9", "9:16", "1:1"])
    parser.add_argument("--duration", type=int, default=10, help="Duration per scene in seconds")
    parser.add_argument("--environment", type=str, default="countryside")
    parser.add_argument("--mood", type=str, default="wonder")
    parser.add_argument("--character", type=str, default="A young girl with short brown hair wearing a simple white dress")
    parser.add_argument("--no-llm", action="store_true", help="Use template-only mode (no API keys needed)")
    parser.add_argument("--list-options", action="store_true", help="List all available options")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    if args.list_options:
        list_options()
    elif args.single:
        prompt = generate_single_prompt(
            description=args.single,
            platform=args.platform,
            environment=args.environment,
            lighting="golden_hour",
            mood=args.mood,
            camera="establishing",
            aspect_ratio=args.aspect,
            duration=args.duration,
        )
        print(prompt)
    elif args.concept:
        gen = GhibliPromptGenerator()
        storyboard = gen.generate_video_prompts(
            concept=args.concept,
            num_scenes=args.scenes,
            platform=args.platform,
            aspect_ratio=args.aspect,
            duration_per_scene=args.duration,
            environment=args.environment,
            mood=args.mood,
            character_description=args.character,
            use_llm=not args.no_llm,
        )
        if args.json:
            print(storyboard.to_json())
        else:
            storyboard.print_storyboard()
    else:
        parser.print_help()
