# Playground

Run `pnpm install` from the repository root, then `pnpm play:dev`.

Choose an example in the toolbar. The eye and code buttons switch between the running demo and its Vue component. Use **Copy code** to copy the complete component.

| Example        | What to try                                                                    |
| -------------- | ------------------------------------------------------------------------------ |
| Signal studio  | Change the waveform and tune its frequency, amplitude, phase, and trace color. |
| Color mixer    | Swap the RGB inputs, adjust ink opacity, and watch the contrast ratio.         |
| Motion stage   | Edit the 2D target, select an easing function, or replay the motion.           |
| Layout presets | Apply a preset from Vue, then tune the layout and surface in the pane tabs.    |
| Pane lifecycle | Detach a binding, rebuild the pane, and compare mount and disposal counts.     |

The examples use UnoCSS utilities and share the frame, stage, and buttons in `src/components/`. The colors and native Tweakpane settings live in `src/theme.css`. Shiki highlights the Vue files that Vite runs in both light and dark themes.

Run `pnpm play:build` to build the playground.
