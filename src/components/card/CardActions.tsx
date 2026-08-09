import type { MouseEvent } from "react";
import type { TmdbItem, WatchStatus } from "../../types/types";
import { Icon } from "../ui/Icon";

type Props = {
  item: TmdbItem;
  isInList: boolean;
  showListMenu: boolean;
  hasNotification: boolean;
  onPlay: (event: MouseEvent) => void;
  onToggleList: (event: MouseEvent) => void;
  onSelectStatus: (event: MouseEvent, status: WatchStatus) => void;
  onRemove: (event: MouseEvent) => void;
  onToggleNotification: (event: MouseEvent) => void;
  onInfo: (event: MouseEvent) => void;
};

export function CardActions(props: Props) {
  const { item, isInList, showListMenu, hasNotification } = props;
  const statuses: Array<[WatchStatus, string]> = [
    ["da-guardare", "Da guardare"], ["in-corso", "In corso"], ["gia-guardato", "Già guardato"],
  ];
  return (
    <div className="expanded-actions-row">
      <div className="expanded-primary-actions">
        <button className="exp-btn-play" onClick={props.onPlay} title="Riproduci"><Icon name="play" size={22} /></button>
        <div className="expanded-list-control">
          <button className={`exp-btn-list ${isInList ? "active" : ""}`} type="button" onClick={props.onToggleList} title="Gestisci lista">
            <Icon name={isInList ? "check" : "plus"} size={22} />
          </button>
          {showListMenu && (
            <div className="list-dropdown-menu" onClick={(event) => event.stopPropagation()}>
              {statuses.map(([status, label]) => (
                <button key={status} className={item.status === status ? "active-status" : ""} onClick={(event) => props.onSelectStatus(event, status)}>{label}</button>
              ))}
              {isInList && <button className="remove-btn" onClick={props.onRemove}>Rimuovi dalla lista</button>}
            </div>
          )}
        </div>
        <button className={`exp-btn-notify ${hasNotification ? "active" : ""}`} type="button" onClick={props.onToggleNotification} title={hasNotification ? "Notifiche attive" : "Avvisami sulle uscite"}>
          <Icon name="bell" size={18} />
        </button>
        <div className="expanded-title-text" title={item.title}>{item.title}</div>
      </div>
      <div className="expanded-secondary-actions">
        <button className="exp-btn-info" onClick={props.onInfo} title="Altre info"><Icon name="chevron-right" size={22} /></button>
      </div>
    </div>
  );
}
