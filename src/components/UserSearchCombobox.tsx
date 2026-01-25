import { useState, useRef, useEffect, useMemo } from 'react';

interface User {
    id: string;
    name: string;
    userId?: string;
    email?: string;
    partner?: { name: string };
}

interface UserSearchComboboxProps {
    users: User[];
    selectedUserId: string;
    onUserSelect: (userId: string) => void;
}

export default function UserSearchCombobox({ users, selectedUserId, onUserSelect }: UserSearchComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1); // -1 for "All Users", 0+ for filtered users
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Initialize search term when selectedUserId changes
    useEffect(() => {
        if (selectedUserId) {
            const selectedUser = users.find(u => u.id === selectedUserId);
            if (selectedUser) {
                setSearchTerm(selectedUser.name);
            }
        } else {
            setSearchTerm('');
        }
    }, [selectedUserId, users]);

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setActiveIndex(-1);
                // Reset search term to selected user name if closed without selection change
                if (selectedUserId) {
                    const selectedUser = users.find(u => u.id === selectedUserId);
                    if (selectedUser && searchTerm !== selectedUser.name) {
                        setSearchTerm(selectedUser.name);
                    }
                } else if (searchTerm !== '') {
                    setSearchTerm('');
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedUserId, users, searchTerm]);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users.slice(0, 20); // Limit initial display
        const lowerTerm = searchTerm.toLowerCase();
        const matches = users.filter(user =>
            user.name.toLowerCase().includes(lowerTerm) ||
            (user.userId || '').toLowerCase().includes(lowerTerm) ||
            (user.email || '').toLowerCase().includes(lowerTerm) ||
            (user.partner?.name || '').toLowerCase().includes(lowerTerm)
        );
        return matches.slice(0, 20); // Limit search results
    }, [users, searchTerm]);

    const hasMoreResults = useMemo(() => {
        if (!searchTerm) return users.length > 20;
        const lowerTerm = searchTerm.toLowerCase();
        const count = users.filter(user =>
            user.name.toLowerCase().includes(lowerTerm) ||
            (user.userId || '').toLowerCase().includes(lowerTerm) ||
            (user.email || '').toLowerCase().includes(lowerTerm) ||
            (user.partner?.name || '').toLowerCase().includes(lowerTerm)
        ).length;
        return count > 20;
    }, [users, searchTerm]);


    const handleFocus = () => {
        setIsOpen(true);
        inputRef.current?.select();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        setActiveIndex(0); // Reset selection to first item on search
        if (e.target.value === '') {
            onUserSelect('');
            setActiveIndex(-1);
        }
    };

    const handleSelect = (user: User) => {
        onUserSelect(user.id);
        setSearchTerm(user.name);
        setIsOpen(false);
        setActiveIndex(-1);
    };

    const selectAllUsers = () => {
        onUserSelect('');
        setSearchTerm('');
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return;

        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        // -1: All Users
        // 0 to filteredUsers.length - 1: Users
        const maxIndex = filteredUsers.length - 1;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => prev < maxIndex ? prev + 1 : prev);
                // Scroll adjustment could be added here
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => prev > -1 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex === -1) {
                    selectAllUsers();
                } else if (activeIndex >= 0 && activeIndex < filteredUsers.length) {
                    handleSelect(filteredUsers[activeIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                inputRef.current?.blur();
                break;
        }
    };

    // Auto-scroll to active item
    useEffect(() => {
        if (isOpen && listRef.current) {
            const activeItem = listRef.current.children[activeIndex + 1] as HTMLElement; // +1 for "All Users"
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [activeIndex, isOpen]);


    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-8"
                    placeholder="ユーザーを検索..."
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                />
                {searchTerm && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent dropdown form reopening immediately
                            selectAllUsers();
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {isOpen && (
                <div
                    ref={listRef}
                    className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
                >
                    {filteredUsers.length === 0 && !searchTerm ? (
                        // Should not happen if users array is populated, but handle empty state
                        <div className="cursor-default select-none relative py-2 px-4 text-gray-700">
                            ユーザーがいません
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="cursor-default select-none relative py-2 px-4 text-gray-700">
                            見つかりませんでした
                        </div>
                    ) : (
                        <>
                            <div
                                className={`cursor-pointer select-none relative py-2 px-4 ${activeIndex === -1 ? 'bg-blue-100 text-blue-900' : 'text-gray-900 hover:bg-blue-50'}`}
                                onClick={selectAllUsers}
                                onMouseEnter={() => setActiveIndex(-1)}
                            >
                                <span className="block truncate font-medium">全ユーザーを表示</span>
                            </div>
                            {filteredUsers.map((user, index) => (
                                <div
                                    key={user.id}
                                    className={`cursor-pointer select-none relative py-2 px-4 ${activeIndex === index ? 'bg-blue-100 text-blue-900' : 'text-gray-900 hover:bg-blue-50'
                                        } ${selectedUserId === user.id ? 'font-medium' : ''}`}
                                    onClick={() => handleSelect(user)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                >
                                    <div className="flex flex-col">
                                        <span className="block truncate">
                                            {user.name}
                                        </span>
                                        <span className="text-xs text-gray-500 truncate">
                                            {user.userId} {user.partner?.name ? `• ${user.partner.name}` : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {hasMoreResults && (
                                <div className="cursor-default select-none relative py-2 px-4 text-xs text-gray-400 text-center border-t">
                                    他候補あり...検索して絞り込んでください
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
