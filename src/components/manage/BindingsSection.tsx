import { FC } from 'react';
import { Link2, UserPlus, MessageSquarePlus, X } from 'lucide-react';
import type { ScriptBindingEntry } from '../../types/script.js';
import { t } from '../../i18n/index.js';

export interface ActiveContext {
  characterId: string | null;
  characterName: string | null;
  chatId: string | null;
}

interface BindingsSectionProps {
  bindings: ScriptBindingEntry[];
  activeContext: ActiveContext;
  onAdd: (entry: ScriptBindingEntry) => void;
  onRemove: (index: number) => void;
}

export const BindingsSection: FC<BindingsSectionProps> = ({
  bindings,
  activeContext,
  onAdd,
  onRemove,
}) => {
  const handleAddCharacter = () => {
    const { characterId, characterName } = activeContext;
    if (!characterId) return;
    if (bindings.some(b => b.type === 'character' && b.characterId === characterId)) return;
    onAdd({ type: 'character', characterId, displayName: characterName ?? characterId });
  };

  const handleAddChat = () => {
    const { chatId, characterName } = activeContext;
    if (!chatId) return;
    if (bindings.some(b => b.type === 'chat' && b.chatId === chatId)) return;
    const displayName = characterName ? `${characterName} — ${chatId.slice(0, 8)}` : chatId.slice(0, 8);
    onAdd({ type: 'chat', chatId, displayName });
  };

  return (
    <div className="ls-bindings">
      <div className="ls-bindings-row">
        <Link2 size={11} style={{ color: 'var(--lumiverse-text-muted)', flexShrink: 0 }} />

        {bindings.length === 0 ? (
          <span className="ls-bindings-global">{t('Runs globally')}</span>
        ) : (
          bindings.map((b, i) => (
            <span key={i} className="ls-binding-chip">
              {b.type === 'character'
                ? <UserPlus size={10} style={{ color: 'var(--lumiverse-accent)' }} />
                : <MessageSquarePlus size={10} style={{ color: 'var(--lumiverse-accent)' }} />}
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.displayName}
              </span>
              <button className="ls-chip-remove" onClick={() => onRemove(i)} title={t('Remove binding')}>
                <X size={9} />
              </button>
            </span>
          ))
        )}

        <button
          className="ls-bindings-add"
          onClick={handleAddCharacter}
          disabled={!activeContext.characterId}
          title={activeContext.characterId ? t('Bind to current character') : t('Open a chat first')}
        >
          <UserPlus size={10} />
          {t('+char')}
        </button>
        <button
          className="ls-bindings-add"
          onClick={handleAddChat}
          disabled={!activeContext.chatId}
          title={activeContext.chatId ? t('Bind to current chat') : t('Open a chat first')}
        >
          <MessageSquarePlus size={10} />
          {t('+chat')}
        </button>
      </div>
    </div>
  );
};
