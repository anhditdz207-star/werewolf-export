import { useState } from 'react';
import { audioManager } from '../../lib/audio';
import './SettingsPanel.css';

interface SettingsPanelProps {
  onClose: () => void;
  onChangeAvatar: () => void;
  onRename: () => void;
  onLogout: () => void;
}

export function SettingsPanel({ onClose, onChangeAvatar, onRename, onLogout }: SettingsPanelProps) {
  const [musicVal, setMusicVal] = useState(() => Math.round(audioManager.getBgmVolume() * 100));
  const [sfxVal, setSfxVal] = useState(() => Math.round(audioManager.getSfxVolume() * 100));
  const [micVal, setMicVal] = useState(90);
  const [vibrate, setVibrate] = useState(() => audioManager.isVibrationEnabled());

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="st-stage" onClick={(e) => e.stopPropagation()}>
        <div className="st-content">
          <div className="st-panel-wrap">
            <button type="button" className="close-btn" onClick={onClose} aria-label="Đóng" />

            <button type="button" className="row-click avatar-row" onClick={onChangeAvatar} aria-label="Đổi ảnh đại diện" />
            <button type="button" className="row-click rename-row" onClick={onRename} aria-label="Đổi tên" />

            <div className="slider-row music-row">
              <input
                type="range"
                className="st-slider"
                min={0}
                max={100}
                value={musicVal}
                style={{ ['--fill' as string]: `${musicVal}%` }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMusicVal(v);
                  audioManager.setBgmVolume(v / 100);
                }}
              />
              <span className="slider-value">{musicVal}%</span>
            </div>

            <div className="slider-row sfx-row">
              <input
                type="range"
                className="st-slider"
                min={0}
                max={100}
                value={sfxVal}
                style={{ ['--fill' as string]: `${sfxVal}%` }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSfxVal(v);
                  audioManager.setSfxVolume(v / 100);
                  audioManager.playSfx('click');
                }}
              />
              <span className="slider-value">{sfxVal}%</span>
            </div>

            <div className="slider-row mic-row">
              <input
                type="range"
                className="st-slider"
                min={0}
                max={100}
                value={micVal}
                style={{ ['--fill' as string]: `${micVal}%` }}
                onChange={(e) => setMicVal(Number(e.target.value))}
              />
              <span className="slider-value">{micVal}%</span>
            </div>

            <div className="toggle-row vibrate-row">
              <span className="toggle-state">{vibrate ? 'BẬT' : 'TẮT'}</span>
              <label className="st-switch">
                <input
                  type="checkbox"
                  checked={vibrate}
                  onChange={() => {
                    const next = !vibrate;
                    setVibrate(next);
                    audioManager.setVibrationEnabled(next);
                    if (next) audioManager.vibrate();
                  }}
                />
                <span className="slider-toggle" />
              </label>
            </div>

            <button type="button" className="logout-btn" onClick={onLogout} aria-label="Đăng xuất" />
          </div>
        </div>
      </div>
    </div>
  );
}
