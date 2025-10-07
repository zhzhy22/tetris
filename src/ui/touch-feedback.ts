import type { ControlInput } from '../core/game-loop';

export interface TouchFeedbackOptions {
  mount: HTMLElement;
  highlightDurationMs?: number;
}

export interface TouchFeedback {
  signal(input: ControlInput): void;
  destroy(): void;
}

type GestureId = 'move' | 'rotate' | 'soft-drop' | 'hard-drop';

type GestureDefinition = {
  id: GestureId;
  title: string;
  description: string;
  icon: string;
};

const GESTURES: GestureDefinition[] = [
  {
    id: 'move',
    title: '左右滑动',
    description: '移动方块',
    icon: '⇆',
  },
  {
    id: 'rotate',
    title: '轻点或上滑',
    description: '旋转方块',
    icon: '⟳',
  },
  {
    id: 'soft-drop',
    title: '短下滑 (<150ms)',
    description: '软降',
    icon: '⬇',
  },
  {
    id: 'hard-drop',
    title: '长下滑 (≥150ms)',
    description: '硬降',
    icon: '⤓',
  },
];

interface GestureElementState {
  element: HTMLLIElement;
  activeTimeout: number | null;
}

const DEFAULT_HIGHLIGHT_DURATION_MS = 450;

export function createTouchFeedback(options: TouchFeedbackOptions): TouchFeedback {
  const { mount } = options;
  const highlightDuration = Math.max(150, options.highlightDurationMs ?? DEFAULT_HIGHLIGHT_DURATION_MS);

  const root = document.createElement('section');
  root.className = 'touch-feedback';
  root.setAttribute('aria-label', '触控手势提示');

  const title = document.createElement('h3');
  title.className = 'touch-feedback__title';
  title.textContent = '触控手势';
  root.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'touch-feedback__list';
  list.setAttribute('role', 'list');
  root.appendChild(list);

  const gestureElements = new Map<GestureId, GestureElementState>();

  for (const definition of GESTURES) {
    const item = document.createElement('li');
    item.className = 'touch-feedback__item';
    item.dataset.gesture = definition.id;

    const icon = document.createElement('span');
    icon.className = 'touch-feedback__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = definition.icon;

    const content = document.createElement('div');
    content.className = 'touch-feedback__content';

    const itemTitle = document.createElement('span');
    itemTitle.className = 'touch-feedback__item-title';
    itemTitle.textContent = definition.title;

    const description = document.createElement('span');
    description.className = 'touch-feedback__description';
    description.textContent = definition.description;

    content.append(itemTitle, description);
    item.append(icon, content);
    list.appendChild(item);

    gestureElements.set(definition.id, { element: item, activeTimeout: null });
  }

  mount.appendChild(root);

  const clearActiveState = (state: GestureElementState) => {
    if (state.activeTimeout !== null) {
      window.clearTimeout(state.activeTimeout);
      state.activeTimeout = null;
    }
    state.element.classList.remove('touch-feedback__item--active');
  };

  const activateGesture = (id: GestureId) => {
    const state = gestureElements.get(id);
    if (!state) {
      return;
    }
    state.element.classList.add('touch-feedback__item--active');
    if (state.activeTimeout !== null) {
      window.clearTimeout(state.activeTimeout);
    }
    state.activeTimeout = window.setTimeout(() => {
      state.element.classList.remove('touch-feedback__item--active');
      state.activeTimeout = null;
    }, highlightDuration);
  };

  const gestureFromInput = (input: ControlInput): GestureId | null => {
    switch (input.type) {
      case 'move':
        if (input.repeat) {
          return null;
        }
        return 'move';
      case 'rotate':
        return 'rotate';
      case 'softDrop':
        if (input.repeat) {
          return null;
        }
        return 'soft-drop';
      case 'hardDrop':
        return 'hard-drop';
      default:
        return null;
    }
  };

  return {
    signal(input) {
      const gesture = gestureFromInput(input);
      if (!gesture) {
        return;
      }
      activateGesture(gesture);
    },
    destroy() {
      gestureElements.forEach((state) => {
        clearActiveState(state);
      });
      gestureElements.clear();
      if (root.parentElement === mount) {
        mount.removeChild(root);
      }
    },
  };
}
