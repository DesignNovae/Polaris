      // Polaris single-module card; original tilt, media and reveal renderer retained.
      const applyModule = entry => {
        if (!entry || typeof entry.name !== "string" || typeof entry.description !== "string") return;
        const card = cards[0];
        if (typeof entry.icon === "string" && entry.icon.startsWith("data:image/png;base64,") && card.moduleIcon !== entry.icon) {
          card.moduleIcon = entry.icon;
          const icon = new Image();
          icon.onload = () => {
            const art = document.createElement("canvas"); art.width = WIDTH; art.height = HEIGHT;
            const paint = art.getContext("2d");
            const tones = ["#d8b48c", "#ca899c", "#9aaa91", "#c6a56c", "#d49baa", "#cbb67c", "#9fb4bb", "#b3a1c4"];
            const stock = paint.createLinearGradient(0, 0, WIDTH, HEIGHT);
            stock.addColorStop(0, "#faf6f0"); stock.addColorStop(1, tones[entry.index % tones.length] || tones[0]);
            paint.fillStyle = stock; paint.fillRect(0, 0, WIDTH, HEIGHT);
            // A printed field under the sculptural module emblem, revealed by the original mask.
            for (let y = 0; y < HEIGHT; y += 6) for (let x = 0; x < WIDTH; x += 6) {
              paint.fillStyle = `rgba(70,39,24,${.025 + (Math.sin(x * .12 + y * .09) + 1) * .025})`;
              paint.beginPath(); paint.arc(x, y, 1, 0, Math.PI * 2); paint.fill();
            }
            paint.save(); paint.shadowColor = "rgba(44,24,16,.3)"; paint.shadowBlur = 28; paint.shadowOffsetY = 24;
            paint.drawImage(icon, 78, 52, 520, 520); paint.restore();
            card.image.src = art.toDataURL("image/png");
          };
          icon.src = entry.icon;
        }
        card.shell.dataset.name = entry.name;
        card.shell.setAttribute("role", "group");
        card.shell.setAttribute("aria-label", entry.name + ". " + entry.description);
        const copy = card.shell.querySelector(".copy");
        copy.replaceChildren();
        const title = document.createElement("span"); title.className = "reveal-word"; title.textContent = entry.name;
        copy.append(title);
        const panel = card.shell.querySelector(".copy-panel");
        panel.setAttribute("aria-label", entry.name + ". " + entry.description);
        let paragraph = panel.querySelector(".polaris-detail");
        if (!paragraph) {
          paragraph = document.createElement("p"); paragraph.className = "polaris-detail"; panel.append(paragraph);
          const explore = document.createElement("button"); explore.className = "polaris-explore";
          explore.addEventListener("click", event => { event.stopPropagation(); parent.postMessage({ polarisExplore: true }, "*"); });
          panel.append(explore);
          const close = document.createElement("button"); close.className = "polaris-close";
          close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", "Close module details");
          close.addEventListener("click", event => { event.stopPropagation(); parent.postMessage({ polarisClose: true }, "*"); });
          card.dragPlane.append(close);
          [explore, close].forEach(control => { control.tabIndex = -1; control.setAttribute("aria-hidden", "true"); });
        }
        paragraph.textContent = entry.description;
        panel.querySelector(".polaris-explore").textContent = `Explore ${entry.name.toLowerCase()} ↗`;
        scene.setAttribute("aria-label", entry.name + " details");
        scene.querySelector(".stack").setAttribute("aria-label", entry.name + " card");
        document.title = "Polaris / " + entry.name;
        updateStack();
        reportControls();
      };
      const reportControls = () => {
        const bounds = selector => {
          const element = document.querySelector(selector); if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };
        parent.postMessage({ polarisControls: { close: bounds(".polaris-close"), explore: bounds(".polaris-explore") } }, "*");
      };
      window.addEventListener("resize", reportControls);
      let controlFrames = 0;
      const followTilt = () => { reportControls(); if (--controlFrames > 0) requestAnimationFrame(followTilt); };
      window.addEventListener("pointermove", () => { if (!controlFrames) { controlFrames = 24; requestAnimationFrame(followTilt); } else controlFrames = 24; });
      window.addEventListener("load", reportControls);
      window.addEventListener("message", event => {
        if (event.source === parent && event.data?.polarisModule) applyModule(event.data.polarisModule);
      });
      window.addEventListener("keydown", event => {
        if (event.key === "Escape") parent.postMessage({ polarisClose: true }, "*");
      });
      applyModule({ name: "Roadmap", description: "A living admission plan shaped around your level, timeline, and target universities." });
