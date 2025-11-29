import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Pin, PinOff, Edit3, EyeOff, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import Avatar from './Avatar';
import LongPressMenu from './LongPressMenu';
import { ChatSession, AIRole } from '../store';

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  role?: AIRole;
  isIOSCap: boolean;
  itemHeight: number;
  
  // Actions
  onSelect: (sessionId: string) => void;
  onPin: (sessionId: string) => void;
  onUnpin: (sessionId: string) => void;
  onHide: (sessionId: string) => void;
  onRename: (sessionId: string, title: string, anchorEl: HTMLElement | null) => void;
  onDelete: (sessionId: string, anchorEl: HTMLElement | null) => void;
  
  // State
  isActionOpen?: boolean;

  // IOS Actions
  onIOSRename: (sessionId: string, title: string) => void;
  onIOSTrash: (sessionId: string) => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  role,
  isIOSCap,
  itemHeight,
  onSelect,
  onPin,
  onUnpin,
  onHide,
  onRename,
  onDelete,
  isActionOpen,
  onIOSRename,
  onIOSTrash
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownContentRef = useRef<HTMLUListElement>(null);
  const enableLongPressEverywhere = true; // Consistent with Layout.tsx

  const closeDropdown = () => {
    buttonRef.current?.blur();
    (document.activeElement as HTMLElement)?.blur();
  };

  const adjustDropdownPlacement = () => {
    const btn = buttonRef.current;
    const ul = dropdownContentRef.current;
    const container = btn?.parentElement as HTMLElement | null;
    
    if (!btn || !container || !ul) return;

    const prevDisplay = ul.style.display;
    const prevVisibility = ul.style.visibility;
    ul.style.visibility = 'hidden';
    ul.style.display = 'block';
    
    const ulRect = ul.getBoundingClientRect();
    
    ul.style.display = prevDisplay;
    ul.style.visibility = prevVisibility;
    
    const btnRect = btn.getBoundingClientRect();
    const scrollEl = btn.closest('.virtual-scroll-container') as HTMLElement | null;
    
    const bounds = (scrollEl ? scrollEl.getBoundingClientRect() : { 
      top: 0, 
      bottom: window.innerHeight, 
      left: 0, 
      right: window.innerWidth 
    });
    
    const overflowBottom = btnRect.bottom + ulRect.height > bounds.bottom;
    const canOpenTop = btnRect.top - ulRect.height >= bounds.top;
    
    if (overflowBottom && canOpenTop) {
      container.classList.add('dropdown-top');
    } else {
      container.classList.remove('dropdown-top');
    }
    
    const leftEnd = btnRect.right - ulRect.width;
    const leftStart = btnRect.left;
    const endOverflowLeft = leftEnd < bounds.left;
    const startOverflowRight = leftStart + ulRect.width > bounds.right;
    
    container.classList.remove('dropdown-start');
    container.classList.remove('dropdown-center');
    
    if (endOverflowLeft && !startOverflowRight) {
      container.classList.remove('dropdown-end');
      container.classList.add('dropdown-start');
    } else if (endOverflowLeft && startOverflowRight) {
      container.classList.remove('dropdown-end');
      container.classList.add('dropdown-center');
    } else {
      if (!container.classList.contains('dropdown-end')) {
        container.classList.add('dropdown-end');
      }
    }
  };

  const content = (
    <Link
      key={session.id}
      to={`/chat/${session.id}`}
      onClick={() => onSelect(session.id)}
      className={cn(
        "chat-list p-3 pr-2 my-0 transition-colors transition-shadow transform transition-transform group block group select-none",
        isActive
          ? "bg-base-300"
          : "hover:bg-base-200 active:bg-base-300"
      )}
      style={{ height: itemHeight, WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
      draggable={false}
      onDragStart={(e) => { e.preventDefault(); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); }}
      onContextMenu={(e) => { e.preventDefault(); }}
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex items-center flex-1 min-w-0 gap-2">
          <Avatar
            name={role?.name || '未知角色'}
            avatar={role?.avatar}
            size="sm"
          />
          <h4 className="text-sm font-normal text-base-content truncate">
            {session.title}
          </h4>
          {session.isPinned && (
            <Pin className="h-3 w-3 text-base-content/50 flex-shrink-0 mr-1" />
          )}
        </div>
        <div
          className={cn(
            "dropdown dropdown-end",
            isIOSCap ? "hidden" : "",
            isActionOpen ? "block" : "md:hidden group-hover:block"
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseEnter={adjustDropdownPlacement}
        >
          <button
            tabIndex={0}
            className={cn(
              "btn btn-ghost btn-sm btn-circle transition-opacity",
              isActionOpen ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
            )}
            title="更多操作"
            ref={buttonRef}
            onFocus={adjustDropdownPlacement}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <ul 
            tabIndex={0} 
            className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box min-w-44"
            ref={dropdownContentRef}
          >
            <li>
              <button
                onClick={() => {
                  if (session.isPinned) {
                    onUnpin(session.id);
                  } else {
                    onPin(session.id);
                  }
                  closeDropdown();
                }}
                className="text-base gap-3"
              >
                {session.isPinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
                {session.isPinned ? '取消置顶' : '置顶'}
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  onRename(session.id, session.title, buttonRef.current);
                  closeDropdown();
                }}
                className="text-base gap-3"
              >
                <Edit3 className="h-4 w-4" />
                重命名
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  onHide(session.id);
                  closeDropdown();
                }}
                className="text-base gap-3"
              >
                <EyeOff className="h-4 w-4" />
                隐藏对话
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  onDelete(session.id, buttonRef.current);
                  closeDropdown();
                }}
                className="text-base text-error gap-3"
              >
                <Trash2 className="h-4 w-4" />
                移至回收站
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Link>
  );

  if (enableLongPressEverywhere || isIOSCap) {
    const items = [
      {
        key: 'pin',
        label: session.isPinned ? '取消置顶' : '置顶',
        icon: session.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />,
        onClick: () => { if (session.isPinned) { onUnpin(session.id); } else { onPin(session.id); } }
      },
      {
        key: 'rename',
        label: '重命名',
        icon: <Edit3 className="h-4 w-4" />,
        onClick: () => onIOSRename(session.id, session.title)
      },
      {
        key: 'hide',
        label: '隐藏对话',
        icon: <EyeOff className="h-4 w-4" />,
        onClick: () => onHide(session.id)
      },
      {
        key: 'trash',
        label: '移至回收站',
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => onIOSTrash(session.id)
      }
    ];
    return <LongPressMenu items={items}>{content}</LongPressMenu>;
  }

  return content;
};

export default React.memo(SessionItem);
