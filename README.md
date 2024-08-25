<!-- PROJECT SHIELDS -->
<!--
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->
[![PyPI version][pypi-shield]][pypi-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Website][website-shield]][website-url]


<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://videodb.io/">
    <img src="https://codaio.imgix.net/docs/_s5lUnUCIU/blobs/bl-RgjcFrrJjj/d3cbc44f8584ecd42f2a97d981a144dce6a66d83ddd5864f723b7808c7d1dfbc25034f2f25e1b2188e78f78f37bcb79d3c34ca937cbb08ca8b3da1526c29da9a897ab38eb39d084fd715028b7cc60eb595c68ecfa6fa0bb125ec2b09da65664a4f172c2f" alt="Logo" width="300" height="">
  </a>

<h2 align="center">PromptClip ✄ </h3>

  <p align="center">
    Create video clips using LLM prompts
    <br />
    <a href="https://github.com/video-db/PromptClip/issues">🐞Report a Bug</a> 
    ·
    <a href="https://github.com/video-db/PromptClip/issues">💡Suggest a Feature</a> 
</p>

<!-- ABOUT THE PROJECT -->

# PromptClip: Create Instant Video Clips with LLM Prompts 🍭

## What does it do? 🤔

It allows any developer to:

* 📚 Upload a video from any source (Local Files, Youtube, S3 etc.)
* 🔍 Prompt that video in natural language with queries like `Show funny moments in the video`
  or `find the moments useful for social media trailer`
* 🎛️ Use any LLM of your choice like OpenAI, Claude or Gemeni Pro.
* 🌟 Instantly watch the clip of those moments.
* 🛠️ Finetune the clip or supercut by ranking results, managing length of the clip etc.
* 🎸 Add music or image overlay to the clip.

---
## Results 🎉

Checkout these prompts and the results 👉🏼

| Original Video                                                                                   | Prompt                                                                                    | Link                                                                                                                           |
|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| [Shark Tank](https://www.youtube.com/watch?v=HpUR7-Oe1ss)                                                   | Find every moment where a deal was offered                                                | [watch](https://console.videodb.io/player?url=https://stream.videodb.io/v3/published/manifests/f46f8de8-725a-410f-a83b-3b5e73a6b29a.m3u8) |
| [Useful Gadgets](https://www.youtube.com/watch?v=bGmXrMW9ucU)                                   | Show me moments in the video where the host discusses or reveals the pricing of the gadgets | [watch](https://console.videodb.io/player?url=https://stream.videodb.io/v3/published/manifests/b13d64f2-3294-4e75-bf68-ed7ccae7006d.m3u8) |
| [Sponsorship Details of Huberman Podcast](https://www.youtube.com/watch?v=LYYyQcAJZfk)          | Find details about every sponsor                                                          | [watch](https://console.videodb.io/player?url=https://stream.videodb.io/v3/published/manifests/13c5d0de-8fcd-435a-8e22-a7338f5465f0.m3u8) |
| [Highlights from Masterchef Episode](https://www.youtube.com/watch?v=4JVzznqOF0k)                          | Show me the feedback from every judge                                                     | [watch](https://console.videodb.io/player?url=https://stream.videodb.io/v3/published/manifests/109cb830-9a5a-4c89-a3fa-f4be92f2c3db.m3u8) |
| [Important Topics/Advice from a Lecture](https://www.youtube.com/watch?v=HAnw168huqA)           | Find sentences where anxiety is discussed                                                 | [watch](https://console.videodb.io/player?url=https://stream.videodb.io/v3/published/manifests/f9faefd3-bb66-4756-a49b-dc30bdcf4617.m3u8) |
| [Tech Review Video](https://www.youtube.com/watch?v=dtp6b76pMak)                                 | Find sentences where host explains about the battery                                      | [watch](https://console.videodb.io/player?url=https://stream.videodb.io/v3/published/manifests/e6ce8133-ed7d-4dad-a070-ead778a0d2d3.m3u8) |
| [Travel Video](https://www.youtube.com/watch?v=sV1Z2LXtHqc)                                     | What are some popular tourist destinations in Sri Lanka                                   | [watch](https://console.videodb.io/player?url=https://stream.videodb.io/v3/published/manifests/36aba200-e4e6-40c0-aa45-8eafdf844fe0.m3u8) |

## How do I use it? 🛠️

- **Get your API key:** Sign up on [VideoDB console](https://console.videodb.io) (Free for the first 50 uploads, no
  credit card required). 🆓
- **Set `VIDEO_DB_API_KEY`:** Enter your key in the `env` file.
- **Set `OPENAI_API_KEY` or `ANTHROPIC_KEY`:** Add your LLM API Key in the `env` file.
- **Install dependencies:** Run `pip install -r requirements.txt` in your terminal.
- **Run locally:**  Run the notebook `PromptClip_text.ipynb`, `PromptClip_visual.ipynb` and `PromptClip_multimodal.ipynb` to experiment with your prompts and ranking of results.

---
<!-- ROADMAP -->

## Roadmap 🛣️

1. Add support for music generation models to jazzup the cuts.
2. Integrate with other projects like Pika Labs and Midjourney.

---
<!-- CONTRIBUTING -->

## Contributing 🤝

Your contributions make the open-source community an incredible place for learning, inspiration, and creativity. We
welcome and appreciate your input! Here's how you can contribute:

- Open issues to share your use cases.
- Participate in brainstorming solutions for our roadmap.
- Suggest improvements to the codebase.

### Contribution Steps

1. Fork the Project 🍴
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request 📬

---

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[pypi-shield]: https://img.shields.io/pypi/v/videodb?style=for-the-badge

[pypi-url]: https://pypi.org/project/videodb/

[python-shield]:https://img.shields.io/pypi/pyversions/videodb?style=for-the-badge

[stars-shield]: https://img.shields.io/github/stars/video-db/promptClip.svg?style=for-the-badge

[stars-url]: https://github.com/video-db/promptClip/stargazers

[issues-shield]: https://img.shields.io/github/issues/video-db/videodb-python.svg?style=for-the-badge

[issues-url]: https://github.com/video-db/promptClip/issues

[website-shield]: https://img.shields.io/website?url=https%3A%2F%2Fvideodb.io%2F&style=for-the-badge&label=videodb.io

[website-url]: https://videodb.io/

