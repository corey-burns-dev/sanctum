import axios from "axios";;
import axios from 'axios';
import { Hash, Send, Trophy, User } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAuthToken, getCurrentUser } from '@/hooks';
import { useToast } from '@/hooks/use-toast';

type GameState = {
	board: string[][];
	status: 'pending' | 'active' | 'finished' | 'cancelled';
	winner_id: number | null;
	next_turn: number;
	is_draw: boolean;
};

type ChatMessage = {
	user_id: number;
	username: string;
	text: string;
};

export default function TicTacToe() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { toast } = useToast();
	const currentUser = getCurrentUser();
	const token = getAuthToken();

	const [gameState, setGameState] = useState<GameState | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [chatInput, setChatInput] = useState('');
	const [room, setRoom] = useState<any>(null);

	const ws = useRef<WebSocket | null>(null);
	const chatEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Fetch room info
		axios
			.get(`/api/games/rooms/${id}`)
			.then(res => {
				setRoom(res.data);
				if (res.data.current_state) {
					try {
						const board = JSON.parse(res.data.current_state);
						setGameState({
							board: Array.isArray(board)
								? board
								: [
										['', '', ''],
										['', '', ''],
										['', '', ''],
									],
							status: res.data.status,
							winner_id: res.data.winner_id,
							next_turn: res.data.next_turn_id,
							is_draw: res.data.is_draw,
						});
					} catch (e) {
						console.error('Failed to parse board state', e);
					}
				}
			})
			.catch(() => {
				toast({ title: 'Error', description: 'Game not found', variant: 'destructive' });
				navigate('/games');
			});

		// Connect WebSocket
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const host = window.location.host;
		const wsUrl = `${protocol}//${host}/api/ws/game?room_id=${id}&token=${token}`;

		ws.current = new WebSocket(wsUrl);

		ws.current.onmessage = event => {
			const action = JSON.parse(event.data);

			switch (action.type) {
				case 'game_state':
					setGameState(action.payload);
					break;
				case 'game_started':
					setGameState(prev =>
						prev
							? { ...prev, status: action.payload.status, next_turn: action.payload.next_turn }
							: null
					);
					toast({ title: 'Game Started!', description: 'Your opponent has joined.' });
					break;
				case 'chat':
					setMessages(prev => [
						...prev,
						{
							user_id: action.user_id,
							username: action.payload.username || 'Opponent',
							text: action.payload.text,
						},
					]);
					break;
				case 'error':
					toast({
						title: 'Game Error',
						description: action.payload.message,
						variant: 'destructive',
					});
					break;
			}
		};

		return () => ws.current?.close();
	}, [id, token, navigate, toast]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const makeMove = (x: number, y: number) => {
		if (!gameState || gameState.status !== 'active' || gameState.next_turn !== currentUser?.id)
			return;
		if (gameState.board[x][y] !== '') return;

		ws.current?.send(
			JSON.stringify({
				type: 'make_move',
				room_id: Number(id),
				payload: { x, y },
			})
		);
	};

	const joinGame = () => {
		ws.current?.send(
			JSON.stringify({
				type: 'join_room',
				room_id: Number(id),
			})
		);
	};

	const sendChat = () => {
		if (!chatInput.trim()) return;
		ws.current?.send(
			JSON.stringify({
				type: 'chat',
				room_id: Number(id),
				payload: { text: chatInput.trim(), username: currentUser?.username },
			})
		);
		setChatInput('');
	};

	if (!room || !gameState) return <div className="p-8 text-center">Loading game...</div>;

	const isCreator = currentUser?.id === room.creator_id;
	const isOpponent = currentUser?.id === room.opponent_id;
	const isPlayer = isCreator || isOpponent;
	const canJoin = !isPlayer && room.status === 'pending';
	const isMyTurn = gameState.status === 'active' && gameState.next_turn === currentUser?.id;

	const getStatusText = () => {
		if (gameState.status === 'pending') return 'Waiting for opponent...';
		if (gameState.status === 'finished') {
			if (gameState.is_draw) return 'Game Draw!';
			return gameState.winner_id === currentUser?.id ? '🎉 You Won!' : '💀 You Lost!';
		}
		return isMyTurn ? '👉 Your Turn' : '⌛ Processing...';
	};

	return (
		<div className="min-h-screen bg-background">
			<Navbar />
			<div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-8">
				{/* Game Area */}
				<div className="lg:col-span-2 space-y-6">
					<Card className="border-2">
						<CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
							<div>
								<CardTitle className="text-2xl font-bold flex items-center gap-2">
									<Hash className="w-6 h-6 text-primary" /> Tic-Tac-Toe
								</CardTitle>
								<p className="text-sm text-muted-foreground">Room ID: #{id}</p>
							</div>
							<div
								className={`px-4 py-2 rounded-full font-bold text-sm ${
									isMyTurn
										? 'bg-primary text-primary-foreground animate-pulse'
										: 'bg-muted text-muted-foreground'
								}`}
							>
								{getStatusText()}
							</div>
						</CardHeader>
						<CardContent className="pt-12 pb-12 flex flex-col items-center">
							{/* The Board */}
							<div className="grid grid-cols-3 gap-4 bg-muted p-4 rounded-2xl shadow-inner border-4 border-muted">
								{gameState.board.map((row, x) =>
									row.map((cell, y) => (
										<button
											key={`${x}-${y}`}
											onClick={() => makeMove(x, y)}
											disabled={gameState.status !== 'active' || !isMyTurn || cell !== ''}
											className={`w-24 h-24 md:w-32 md:h-32 flex items-center justify-center text-5xl font-black rounded-xl transition-all
                                                ${cell === '' && isMyTurn ? 'bg-background hover:bg-primary/10 hover:scale-105 cursor-pointer' : 'bg-background/50 cursor-default'}
                                                ${cell === 'X' ? 'text-primary' : 'text-indigo-500'}
                                                shadow-[0_4px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none
                                            `}
										>
											{cell}
										</button>
									))
								)}
							</div>

							{canJoin && (
								<Button
									size="lg"
									className="mt-8 px-12 text-xl py-6"
									onClick={joinGame}
								>
									Join & Play
								</Button>
							)}

							{gameState.status === 'finished' && (
								<Button
									variant="outline"
									className="mt-8"
									onClick={() => navigate('/games')}
								>
									Back to Games
								</Button>
							)}
						</CardContent>
					</Card>

					<div className="grid grid-cols-2 gap-4">
						<div className="p-4 rounded-xl border-2 bg-card">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
									X
								</div>
								<div>
									<p className="text-xs text-muted-foreground font-bold uppercase tracking-tight">
										Creator
									</p>
									<p className="font-bold">{room.creator.username}</p>
								</div>
							</div>
						</div>
						<div className="p-4 rounded-xl border-2 bg-card">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-500">
									O
								</div>
								<div>
									<p className="text-xs text-muted-foreground font-bold uppercase tracking-tight">
										Opponent
									</p>
									<p className="font-bold">
										{room.opponent?.username || (gameState.status === 'pending' ? '...' : 'Bot')}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Right Sidebar: Chat & Stats */}
				<div className="space-y-6">
					<Card className="h-[500px] flex flex-col border-2 overflow-hidden">
						<div className="p-4 bg-muted/20 border-b font-bold flex items-center gap-2">
							<Send className="w-4 h-4 text-primary" /> Game Chat
						</div>
						<CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
							{messages.map((m, i) => (
								<div
									key={i}
									className={`flex flex-col ${m.user_id === currentUser?.id ? 'items-end' : 'items-start'}`}
								>
									<span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
										{m.username}
									</span>
									<div
										className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] ${
											m.user_id === currentUser?.id
												? 'bg-primary text-primary-foreground rounded-tr-none'
												: 'bg-muted rounded-tl-none'
										}`}
									>
										{m.text}
									</div>
								</div>
							))}
							<div ref={chatEndRef} />
						</CardContent>
						<div className="p-4 border-t bg-background">
							<div className="flex gap-2">
								<Input
									placeholder="GGWP..."
									value={chatInput}
									onChange={e => setChatInput(e.target.value)}
									onKeyDown={e => e.key === 'Enter' && sendChat()}
								/>
								<Button
									size="icon"
									onClick={sendChat}
								>
									<Send className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</Card>

					<div className="bg-muted/30 border-2 border-dashed rounded-xl p-6 text-center">
						<Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
						<h4 className="font-bold">Victory Rewards</h4>
						<p className="text-sm text-muted-foreground mb-4">
							You get +10 VibePoints for every victory in this room.
						</p>
						<Button
							variant="ghost"
							className="w-full text-xs"
							onClick={() => {
								navigator.clipboard.writeText(window.location.href);
								toast({ title: 'Link Copied', description: 'Send it to a friend to invite them!' });
							}}
						>
							Copy Invite Link
						</Button>
					</div>
				</div>
			</div>
		</div>
	);				<p className="font-bold">{room.creator.username}</p>
								</div>
							</div>
						</div>
						<div className="p-4 rounded-xl border-2 bg-card">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-500">
									O
								</div>
								<div>
									<p className="text-xs text-muted-foreground font-bold uppercase tracking-tight">
										Opponent
									</p>
									<p className="font-bold">
										{room.opponent?.username ||
											(gameState.status === "pending" ? "..." : "Bot")}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Right Sidebar: Chat & Stats */}
				<div className="space-y-6">
					<Card className="h-[500px] flex flex-col border-2 overflow-hidden">
						<div className="p-4 bg-muted/20 border-b font-bold flex items-center gap-2">
							<Send className="w-4 h-4 text-primary" /> Game Chat
						</div>
						<CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
							{messages.map((m, i) => (
								<div
									key={i}
									className={`flex flex-col ${m.user_id === currentUser?.id ? "items-end" : "items-start"}`}
								>
									<span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
										{m.username}
									</span>
									<div
										className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] ${
											m.user_id === currentUser?.id
												? "bg-primary text-primary-foreground rounded-tr-none"
												: "bg-muted rounded-tl-none"
										}`}
									>
										{m.text}
									</div>
								</div>
							))}
							<div ref={chatEndRef} />
						</CardContent>
						<div className="p-4 border-t bg-background">
							<div className="flex gap-2">
								<Input
									placeholder="GGWP..."
									value={chatInput}
									onChange={(e) => setChatInput(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && sendChat()}
								/>
								<Button size="icon" onClick={sendChat}>
									<Send className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</Card>

					<div className="bg-muted/30 border-2 border-dashed rounded-xl p-6 text-center">
						<Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
						<h4 className="font-bold">Victory Rewards</h4>
						<p className="text-sm text-muted-foreground mb-4">
							You get +10 VibePoints for every victory in this room.
						</p>
						<Button
							variant="ghost"
							className="w-full text-xs"
							onClick={() => {
								navigator.clipboard.writeText(window.location.href);
								toast({
									title: "Link Copied",
									description: "Send it to a friend to invite them!",
								});
							}}
						>
							Copy Invite Link
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
