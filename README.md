# AI Hub

AI Hub は、複数の仮想ルームハブと AI エージェントを接続し、ネットワーク上の状態変化やパケットの流れを可視化するための管理ツールです。FastAPI ベースのバックエンドと、同梱されたシングルページアプリでリアルタイム連携を行います。

## 主な機能
- ルームハブと AI デバイスの作成・接続・削除
- WebSocket を用いた状態更新・パケット転送のリアルタイム配信
- OpenAI API を利用した AI エージェントの自動応答
- ブラウザ上でのネットワーク可視化とデバイス詳細ビュー

## 前提条件
- Python 3.12 以上
- Poetry
- OpenAI API キー（`OPENAI_API_KEY`）  
  必要に応じて `OPENAI_BASE_URL` も設定できます。

## セットアップ
```bash
poetry install
```

必要に応じて環境変数を設定します。

```bash
export OPENAI_API_KEY="sk-..."
# 独自エンドポイントを利用する場合
export OPENAI_BASE_URL="https://api.example.com/v1"
```

## 開発サーバーの起動
```bash
poetry run uvicorn app.api.main:createApp --factory --reload
```

起動後は `http://localhost:8000/` にアクセスすると、ブラウザでネットワークビューを確認できます。  
API ドキュメント（OpenAPI）は `http://localhost:8000/docs` で参照できます。

## プロジェクト構成
- `app/` : FastAPI アプリケーションとネットワークドメインロジック
- `web/` : フロントエンド（静的ファイル）
- `logs/` : サンプルログ
- `pyproject.toml` : 依存関係とプロジェクト設定

## ライセンス
MIT License
